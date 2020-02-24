---
title: 'Using GitHub Classroom'
date: 2020-02-24
permalink: /posts/2020/02/githubclassroom/
tags:
  - csta
  - educational
  - technical
---
William M. Mongan

In this article, we'll explore GitHub classroom as a tool to manage classroom assignments.  GitHub classroom creates assignments that students "accept" as git repositories.  They can work with their repository on any computer and synchronize or backup their work to the GitHub cloud.  Using GitHub practices like Pull Requests, students can request help from the instructor and receive line-by-line feedback right in the repository, all while developing good habits in the use of git repositories.  Instructors can automate downloading and grading through scripting or through the GitHub Classroom Assistant tool.  In addition, assignments can be specified as group assignments, which create shared repositories as you organize students (or as they self-organize) into teams.  GitHub classroom also allows you to tie your assignments to a "starter repository" in which you can post boilerplate materials or code, instructions, rubrics, and FAQs that you can evolve over time.

# Background: Using GitHub
Because GitHub classroom is built on GitHub and git infrastructure, it is important to understand some git and GitHub basics before using GitHub classroom.  You and your students can get started with a working knowledge of just a few features, and we'll summarize them here.

For starters, you and your students will each need a GitHub account.  You will also need a git installation on your computer.  Most Linux distributions have a package manager through which you can install a git client.  There is a Git Bash utility for Windows that you can download and install as well.  In these examples, I'll be using Cygwin, a POSIX layer for Windows that provides a Linux-like shell terminal along with common GNU and Open Source tools like git.  The commands used here will work in other environments, too.

For an overview of git as a version control system, see [this book](https://git-scm.com/book/en/v2).

## Creating an SSH Key
SSH Keys allow you to present a certificate to the GitHub server that authenticates your user account from your computer.  It is an alternative to password-based authentication.  You can create an SSH key, which will create two files on your "home directory" called ``.ssh/id_rsa`` and ``.ssh/id_rsa.pub``.  The ``.ssh/id_rsa.pub`` file contains your ***public key*** and is the file you will share with GitHub.  The ***private key*** in the other file corresponds to your public key, and, as the name implies, should not be shared with anyone (as it will enable authentication against the public key).

![Creating an SSH Key](/media/2020-02-24-githubclassroom/ssh-keygen.gif)

Once the key is created, you can copy the public key text and paste it on the GitHub website to add it.  It's a good idea to name the key, in case you get a new computer and start a new key; it's a good practice to remove unused public keys from GitHub and other servers.

![Uploading an SSH Public Key to GitHub for Authentication](/media/2020-02-24-githubclassroom/add-ssh-key-github.gif)

## Creating a Repository

![Creating a GitHub Repository](/media/2020-02-24-githubclassroom/create-repo-github.gif)

## Using the Repository

### Clone

![Cloning a GitHub Repository](/media/2020-02-24-githubclassroom/git-clone.gif)

### Basic Repository Operations: Add, Commit, and Push

![Add, Commit, and Push to a GitHub Repository](/media/2020-02-24-githubclassroom/git-commit-push.gif)

#### Other Operations: Removing files, Pulling

![Removing Files, and Pulling to Update Remote Changes](/media/2020-02-24-githubclassroom/git-commit-push.gif)

### Branching

![Creating a Branch](/media/2020-02-24-githubclassroom/git-branch.gif)

### Merging a Branch

![Merging another Branch into the Current Branch](/media/2020-02-24-githubclassroom/git-merge-no-commit-just-push.gif)

Notice that you do not need to commit after performing a merge: the merge *is* a commit on your current branch.  If you perform a ``git commit``, it will provide you a helpful reminder about this.  Instead, you can go ahead and push to the remote GitHub server when you are ready.

Sometimes, team members make changes to the same parts of the same files in different branches (or from different local checkouts).  A ***conflict*** occurs when this happens.  Git offers you some guidance in how to resolve these, and allows you to specify the details as a new commit.  You can find more details on how to do this [here](https://help.github.com/en/github/collaborating-with-issues-and-pull-requests/resolving-a-merge-conflict-using-the-command-line).

# Using GitHub Classroom

## Creating an Organization

![Creating a GitHub Organization](/media/2020-02-24-githubclassroom/classroom-new-org.gif)

## Creating a new Classroom

![Creating a New Classroom](/media/2020-02-24-githubclassroom/classroom-new-classroom.gif)

## Setting Up Your Roster and TA Access

![Setting Up the Class Roster Including TA Access](/media/2020-02-24-githubclassroom/classroom-roster-and-tas.gif)

## Creating an Assignment

![Creating a New Assignment](/media/2020-02-24-githubclassroom/classroom-new-assignment.gif)

## Student View: Accepting an Assignment

![Accepting an Assignment](/media/2020-02-24-githubclassroom/classroom-accept-assignment.gif)

## Student View: Creating a Pull Request on a Branch to Request Help from the Instructor

![Creating a Pull Request on a Branch](/media/2020-02-24-githubclassroom/classroom-pull-request.gif)

## Instructor View: Managing the Pull Request

### Opening the Pull Request

![Accessing a Pull Request](/media/2020-02-24-githubclassroom/classroom-open-pull-request.gif)

### Pull Request Review: Commenting on the Pull Request

![Reviewing a Pull Request](/media/2020-02-24-githubclassroom/classroom-review-pull-request.gif)

## Student View: Merging the Pull Request / Branch

![Merging a Pull Request](/media/2020-02-24-githubclassroom/classroom-merge-pull-request.gif)

## Downloading Assignments for Grading with the GitHub Classroom Assistant

![Downloading Assignments with GitHub Classroom Assistant](/media/2020-02-24-githubclassroom/assistant-download-assignment.gif)

------