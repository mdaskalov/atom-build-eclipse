'use babel';

import fs from 'fs';
import { DOMParser } from 'xmldom';
import xpath from 'xpath';
import _ from 'lodash';
import { EventEmitter } from 'events';

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
        title: 'Bilder Target',
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

export function eclipseBuilder() {
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

  return class MakeBuildProvider extends EventEmitter {
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
      try {
        const doc = new DOMParser().parseFromString(
          fs.readFileSync(this.cwd + '/' + '.cproject').toString(),
          'text/xml'
        );
        this.projectName = xpath.select1(
          atom.config.get('build-eclipse.xpath.projectName'),
          doc
        ).value;
        this.builderCommand = xpath.select1(
          atom.config.get('build-eclipse.xpath.builderCommand'),
          doc
        ).value;
        this.builderArguments = xpath.select1(
          atom.config.get('build-eclipse.xpath.builderArguments'),
          doc
        ).value;
        this.builderTarget = xpath.select1(
          atom.config.get('build-eclipse.xpath.builderTarget'),
          doc
        ).value;
        return (
          this.projectName !== undefined && this.builderCommand !== undefined
        );
      } catch (err) {
        return false;
      }
    }

    settings() {
      const environment = atom.config.get('build-eclipse.environmentVariables');
      if (environment) {
        environment.forEach(entry => {
          const variable = _.split(entry, '=');
          process.env[variable[0]] = variable[1];
        });
      }

      const args = _.split(this.builderArguments, ' ');
      if (this.builderTarget) {
        args.push(this.builderTarget);
      }

      return {
        name: this.projectName,
        exec: this.builderCommand,
        args: args,
        errorMatch: errorMatch,
        warningMatch: warningMatch
      };
    }
  };
}
