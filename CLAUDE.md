# Project Name
This is a projejt of a obsidian plugin to enable communcation with claude shell from obsidian.

# Project Purpose
To make it easier to send commands from obsidian to shell and responses from shell to obsidian directly.

# Issue tracking
This project will be using beads for issue tracking and progress tracking - check ISSUETRACKING.md for details on how to use it.

# Git
On each phase remember to commit the changes with comment etc

# Development Rules
Always add unit tests to the developed code and ensure you are running them to verify if they are passing.

Always add logging to make it more easy for operator to test and run the plugin.

Read ISSUETRACCKING.md before implementineg anything to familiarise youreslv with the BEADS framework to manage tasks.

When given work from the user create basic plan - wait for the user to accept the plan - then move along with ISSUETRACKING.md process.

During planning prefer splitting work into features. So given asks for lets say adding logging and also new feature. Split this work into two features.

# Features:

## Obsidian to claude shell communication
As a user inside obsidian I can use shortcut to open up a modal that will enable me to write a command that will be sent to locally running claude shell on my machine. This command is then executed and results are send back to obsidian.

Use Cases:
- When writing text, or blog posts, I can select text and ask claude to improve / change it

## Running in paraller
- when i select a text claude will add <Claude> and </Claude> tags to mark which text is being worked on by claude - then this text will also `be dimmed` to indicate visually that claude is working on it or this section behind the scenes

## User doesnt need to select session all the time
- a default session can be setup and in the bottom bar there is a status indiciating that session is opened up - and what is the status

##  User create shells should also be able to be used
As a user i can start `claude .` myself and then connect to this shell from obsidian.
