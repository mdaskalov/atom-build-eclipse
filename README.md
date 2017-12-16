# Eclipse C/C++ Project Build

[![apm](https://img.shields.io/apm/v/build-eclipse.svg)](https://atom.io/packages/build-eclipse)
[![apm](https://img.shields.io/apm/dm/build-eclipse.svg)](https://atom.io/packages/build-eclipse)
[![Build Status](https://travis-ci.org/mdaskalov/atom-build-eclipse.svg?branch=master)](https://travis-ci.org/mdaskalov/atom-build-eclipse)

Execute the C/C++ build command configured in the eclipse project file (.cproject) to build the project. The file should be located in the project root directory or the plugin will not be activated.

If used on the latest MacBook Pro the plugin adds two buttons on the TouchBar to build or clean the project.

This package requires [atom-build](https://github.com/noseglid/atom-build) to be installed.

## Installation

Install `build-eclipse` from Atom's [Package Manager](http://flight-manual.atom.io/using-atom/sections/atom-packages/) or the command-line equivalent:

`$ apm install build-eclipse`

## Usage

This package will add a shortcut to clean your project. Use following shortcuts:

**Build the project**

<kbd>Cmd</kbd> <kbd>Alt</kbd> <kbd>B</kbd> / <kbd>Ctrl</kbd> <kbd>Alt</kbd> <kbd>B</kbd> / <kbd>F9</kbd>

**Clean the project**

<kbd>Cmd</kbd> <kbd>Alt</kbd> <kbd>C</kbd> / <kbd>Ctrl</kbd> <kbd>Alt</kbd> <kbd>C</kbd> / <kbd>F10</kbd>
