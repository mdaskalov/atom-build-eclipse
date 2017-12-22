'use babel';

const path = require('path');
const xpath = require('xpath');
const { DOMParser } = require('xmldom');
const { EventEmitter } = require('events');
const { readdirSync, statSync, existsSync, readFileSync } = require('fs');
const { TouchBar } = require('remote');

const { TouchBarButton } = TouchBar;

const gccErrorMatch =
  '(?<file>([A-Za-z]:[\\/])?[^:\\n]+):(?<line>\\d+):(?<col>\\d+):\\s*(fatal error|error):\\s*(?<message>.+)';
const errorMatch = [gccErrorMatch];

const gccWarningMatch =
  '(?<file>([A-Za-z]:[\\/])?[^:\\n]+):(?<line>\\d+):(?<col>\\d+):\\s*(warning):\\s*(?<message>.+)';
const warningMatch = [gccWarningMatch];

export const config = {
  environmentVariables: {
    title: 'Environment variables',
    description:
      'Environment variables to set when the build command is executed. Example: {NAME}={value}, {NAME1}={value1}, ...',
    type: 'array',
    default: ['ATOM=cool'],
    order: 1
  },
  projectRootDirectory: {
    title: 'Project root directory',
    description:
      'Directory to recursively search for eclipse configuration files (.cproject). Leave empty to use the project root directory.',
    type: 'string',
    default: '',
    order: 2
  },
  touchbarButtons: {
    title: 'TouchBar buttons',
    description:
      'Show buttons on the TouchBar to build and clean the project',
    type: 'boolean',
    default: false,
    order: 2
  },
  xpath: {
    title: 'XPath Expressions',
    description:
      'XPath expressions to parse build related parts of the eclipse configuration xml (.cproject)',
    type: 'object',
    collapsed: true,
    properties: {
      projectName: {
        title: 'Project Name',
        description: 'Extract the project name',
        type: 'string',
        default: "//storageModule[@moduleId='cdtBuildSystem']/project/@name",
        order: 1
      },
      builderCommand: {
        title: 'Builder Command',
        description: 'Extract the builder command',
        type: 'string',
        default:
          "//storageModule[@moduleId='cdtBuildSystem']//builder/@command",
        order: 2
      },
      builderArguments: {
        title: 'Builder Arguments',
        description: 'Extract the builder command arguments',
        type: 'string',
        default:
          "//storageModule[@moduleId='cdtBuildSystem']//builder/@arguments",
        order: 3
      },
      builderTarget: {
        title: 'Builder Target',
        description: 'Extract the default target to build',
        type: 'string',
        default:
          "//storageModule[@moduleId='cdtBuildSystem']//builder/@incrementalBuildTarget",
        order: 4
      }
    },
    order: 3
  }
};

const getXPath = (name, doc) => {
  try {
    const expression = atom.config.get('build-eclipse.xpath.' + name);
    const node = xpath.select1(expression, doc);

    if (typeof node === 'string') return node;
    if (node) return node.value;
  } catch (err) {
    err.expression = name;
    throw err;
  }
};

const searchProjectFiles = (dir, list = []) => {
  readdirSync(dir).forEach(file => {
    const fullName = path.join(dir, file);
    try {
      if (existsSync(fullName) && statSync(fullName).isDirectory()) {
        list = searchProjectFiles(fullName, list);
      } else if (file === '.cproject') {
        list.push(fullName);
      }
    } catch (err) {
      atom.notifications.addWarning('Error searching for project files', {
        detail: err.message
      });
    }
  });
  return list;
};

const getProjectConfiguration = (projectFile, env) => {
  try {
    const doc = new DOMParser().parseFromString(
      readFileSync(projectFile).toString(),
      'text/xml'
    );
    const projectName = getXPath('projectName', doc);
    const builderCommand = getXPath('builderCommand', doc);
    const builderArguments = getXPath('builderArguments', doc);
    const builderTarget = getXPath('builderTarget', doc);

    if (projectName !== undefined && builderCommand !== undefined) {
      const args = builderArguments ? builderArguments.trim().split(' ') : [];
      return [
        {
          exec: builderCommand,
          name: `Build Project ${projectName}`,
          args: [...args, builderTarget],
          cwd: path.dirname(projectFile),
          env: env,
          errorMatch: errorMatch,
          warningMatch: warningMatch
        },
        {
          exec: builderCommand,
          name: `Clean Project ${projectName}`,
          args: [...args, 'clean'],
          cwd: path.dirname(projectFile),
          env: env,
          errorMatch: errorMatch,
          warningMatch: warningMatch,
          atomCommandName: 'build:clean'
        }
      ];
    }
  } catch (err) {
    atom.notifications.addWarning(
      `Invalid XPath expression in ${err.expression}!`,
      {
        detail: err.message
      }
    );
  }
};

const setTouchBar = () => {
  const touchBarElements = [];
  touchBarElements.push(
    new TouchBarButton({
      label: 'Build',
      click: () => {
        atom.commands.dispatch(document.activeElement, 'build:trigger');
      }
    })
  );
  touchBarElements.push(
    new TouchBarButton({
      label: 'Clean',
      click: () => {
        atom.commands.dispatch(document.activeElement, 'build:clean');
      }
    })
  );
  const touchBar = new TouchBar(touchBarElements);
  atom.getCurrentWindow().setTouchBar(touchBar);
};

export function provideBuilder() {
  return class EclipseBuildProvider extends EventEmitter {
    constructor(cwd) {
      super();
      this.cwd = cwd;
      atom.config.observe('build-eclipse.environmentVariables', () =>
        this.emit('refresh')
      );
      atom.config.observe('build-eclipse.projectRootDirectory', () =>
        this.emit('refresh')
      );
      atom.config.observe('build-eclipse.xpath', () => this.emit('refresh'));
    }

    getNiceName() {
      return 'Build Eclipse C/C++ Project';
    }

    // List all files in a directory in Node.js recursively in a synchronous fashion
    isEligible() {
      const rootDir = atom.config.get('build-eclipse.projectRootDirectory');
      this.projectFiles = searchProjectFiles(rootDir ? rootDir : this.cwd);
      return this.projectFiles.length !== 0;
    }

    settings() {
      const env = {};
      const environmentVariables = atom.config.get(
        'build-eclipse.environmentVariables'
      );
      if (environmentVariables) {
        environmentVariables.forEach(entry => {
          const variable = entry.trim().split('=');
          env[variable[0]] = variable[1];
        });
      }
      let configurations = [];
      this.projectFiles.forEach(file => {
        configurations = configurations.concat(
          getProjectConfiguration(file, env)
        );
      });
      const touchbarButtons = atom.config.get('build-eclipse.touchbarButtons');
      if (touchbarButtons) {
        setTouchBar();
      }
      console.log('configurations:', configurations);
      return configurations;
    }
  };
}
