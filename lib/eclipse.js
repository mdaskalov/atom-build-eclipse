'use babel';

const path = require('path');
const xpath = require('xpath');
const { DOMParser } = require('xmldom');
const { EventEmitter } = require('events');
const { existsSync, readFileSync } = require('fs');
const { TouchBar } = require('remote');

const { TouchBarButton } = TouchBar;

export const config = {
  environmentVariables: {
    title: 'Environment variables',
    description:
      'Environment variables to set when the build command is executed. Example: {NAME}={value}, {NAME1}={value1}, ...',
    type: 'array',
    default: ['ATOM=cool'],
    order: 1
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
    order: 2
  }
};

function getXPath(name, doc) {
  try {
    const expression = atom.config.get('build-eclipse.xpath.' + name);
    const node = xpath.select1(expression, doc);

    if (typeof node === 'string') return node;
    if (node) return node.value;
  } catch (err) {
    err.expression = name;
    throw err;
  }
}

function setTouchBar(project) {
  const touchBarElements = [];
  touchBarElements.push(new TouchBarButton({
    label: `Build ${project}`,
    click: () => {
      atom.commands.dispatch(document.activeElement, 'build:trigger');
    }
  }));
  touchBarElements.push(new TouchBarButton({
    label: `Clean ${project}`,
    click: () => {
      atom.commands.dispatch(document.activeElement, 'build:clean');
    }
  }));
  const touchBar = new TouchBar(touchBarElements);
  atom.getCurrentWindow().setTouchBar(touchBar);
}

export function provideBuilder() {
  const gccErrorMatch =
    '(?<file>([A-Za-z]:[\\/])?[^:\\n]+):(?<line>\\d+):(?<col>\\d+):\\s*(fatal error|error):\\s*(?<message>.+)';
  const ocamlErrorMatch =
    '(?<file>[\\/0-9a-zA-Z\\._\\-]+)", line (?<line>\\d+), characters (?<col>\\d+)-(?<col_end>\\d+):\\n(?<message>.+)';
  const golangErrorMatch =
    '(?<file>([A-Za-z]:[\\/])?[^:\\n]+):(?<line>\\d+):\\s*(?<message>.*error.+)';
  const errorMatch = [gccErrorMatch, ocamlErrorMatch, golangErrorMatch];

  const gccWarningMatch =
    '(?<file>([A-Za-z]:[\\/])?[^:\\n]+):(?<line>\\d+):(?<col>\\d+):\\s*(warning):\\s*(?<message>.+)';
  const warningMatch = [gccWarningMatch];

  return class EclipseBuildProvider extends EventEmitter {
    constructor(cwd) {
      super();
      this.cwd = cwd;
      atom.config.observe('build-eclipse.environmentVariables', () =>
        this.emit('refresh')
      );
      atom.config.observe('build-eclipse.xpath', () => this.emit('refresh'));
    }

    getNiceName() {
      return 'Build Eclipse C/C++ Project';
    }

    isEligible() {
      this.projectFile = path.join(this.cwd, '.cproject');
      return existsSync(this.projectFile);
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
      try {
        const doc = new DOMParser().parseFromString(
          readFileSync(this.projectFile).toString(),
          'text/xml'
        );
        const projectName = getXPath('projectName', doc);
        const builderCommand = getXPath('builderCommand', doc);
        const builderArguments = getXPath('builderArguments', doc);
        const builderTarget = getXPath('builderTarget', doc);

        if (projectName !== undefined && builderCommand !== undefined) {
          setTouchBar(projectName);
          const args = builderArguments
            ? builderArguments.trim().split(' ')
            : [];
          const defaultTarget = builderTarget ? builderTarget : 'all';
          return [
            {
              name: `Build Project ${projectName}`,
              exec: builderCommand,
              args: [...args, defaultTarget],
              env: env,
              errorMatch: errorMatch,
              warningMatch: warningMatch
            },
            {
              name: `Clean Project ${projectName}`,
              exec: builderCommand,
              args: [...args, 'clean'],
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
      return [];
    }
  };
}
