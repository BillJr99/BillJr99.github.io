---
title: 'Using GitHub Classroom'
date: 2020-02-24
permalink: /posts/2020/02/githubclassroom/
tags:
  - csta
  - educational
  - technical
---

In this article, we'll explore GitHub classroom as a tool to manage classroom assignments.  GitHub classroom creates assignments that students "accept" as git repositories.  They can work with their repository on any computer and synchronize or backup their work to the GitHub cloud.  Using GitHub practices like Pull Requests, students can request help from the instructor and receive line-by-line feedback right in the repository, all while developing good habits in the use of git repositories.  Instructors can automate downloading and grading through scripting or through the GitHub Classroom Assistant tool.  In addition, assignments can be specified as group assignments, which create shared repositories as you organize students (or as they self-organize) into teams.  GitHub classroom also allows you to tie your assignments to a "starter repository" in which you can post boilerplate materials or code, instructions, rubrics, and FAQs that you can evolve over time.

# What You Will Need
Because GitHub classroom is built on GitHub and git infrastructure, it is important to understand some git and GitHub basics before using GitHub classroom.  You and your students can get started with a working knowledge of just a few features, and we'll summarize them here.  Before starting, you should have the following:

1. A GitHub Account
You and your students will each need a GitHub account
2. A git installation
Most Linux distributions have a package manager through which you can install a git client.  There is a Git Bash utility for Windows that you can download and install as well.  In these examples, I'll be using Cygwin, a POSIX layer for Windows that provides a Linux-like shell terminal along with common GNU and Open Source tools like git.  The commands used here will work in other environments, too.
3. Experience with git
For an overview of git as a version control system, see [my article on using Git with GitHub](/posts/2020/02/github/).

# Using GitHub Classroom

## Creating an Organization

GitHub Classroom uses Organizations to manage your classrooms, assignments, and student repositories.  You and your students, TA's, and instructors will be members of your organization (they'll be added throughout the process, so you don't have to do this all yourself).  In addition, student repositories will be incorporated into your organization when they accept assignments.

If you are within an academic institution, you can petition GitHub to make your organization a "Pro" organization free of charge.  This enables you to create assignments for which student repositories will be private.  This is really important to me, because I don't want independent student classwork to be made public!  In this example, I'm just creating a personal organization, but this means that the repositories will be public.

![Creating a GitHub Organization](/media/2020-02-24-githubclassroom/classroom-new-org.gif)

## Creating a new Classroom

![Creating a New Classroom](/media/2020-02-24-githubclassroom/classroom-new-classroom.gif)

## Setting Up Your Roster and TA Access

![Setting Up the Class Roster Including TA Access](/media/2020-02-24-githubclassroom/classroom-roster-and-tas.gif)

## Creating an Assignment

If you specify a starter code repository, that repository will be copied into each student's repository when they accept the assignment.  This is useful for instructions, boilerplate materials, FAQ materials, and rubrics.  You can even push to the student repositories as a grading mechanism.  I tend not to do this, so as to avoid posting grading information to a potentially public forum, but it's useful for private repositories.

I suggest that you do **not** make students administrators on these accounts, so that they can not modify their sharing settings on the repository.  This helps ensure that they do not accidentally make their repository public.

You can specify a deadline as well.  If you do this, the Classroom Assistant tool will download the repository as it was at that time.  No commits after the deadline will be seen.

In addition to creating an individual assignment, you can create a group assignment.  When students accept an assignment, they will be able to organize into a team of up to N students (a number you can specify).  You can also re-use existing groupings to keep teams together.

![Creating a New Assignment](/media/2020-02-24-githubclassroom/classroom-new-assignment.gif)

## Student View: Accepting an Assignment

When students accept an assignment, you'll have a record of it, and they will get a repository that is shared with you and the TA's (and any students in their group, if you created a group assignment).  

The first time a student accepts an assignment, they'll be able to assign themselves to a student in your roster.  This allows you to associate a student's GitHub account name to their actual student identifier.

I tend not to link my GitHub Classrooms with a school roster or LMS, so that I do not risk compromising sensitive student data.  I allow them to self-associate.  There is a risk here that a student will mistakenly identify with another account.  If this happens, that student will not be able to associate with their account.  In practice, I have not had a problem with this, but you'll want to ensure that students are representing themselves properly if you're allowing them to self-assign their account to a student on the roster.

![Accepting an Assignment](/media/2020-02-24-githubclassroom/classroom-accept-assignment.gif)

## Student View: Creating a Pull Request on a Branch to Request Help from the Instructor

If students work in a branch, they can make ***Pull Requests*** on that branch to request reviews and comments from the instructor along the way.  This is a great way to ask questions and seek help.

![Creating a Pull Request on a Branch](/media/2020-02-24-githubclassroom/classroom-pull-request.gif)

## Instructor View: Managing the Pull Request

### Opening the Pull Request

![Accessing a Pull Request](/media/2020-02-24-githubclassroom/classroom-open-pull-request.gif)

### Pull Request Review: Commenting on the Pull Request

![Reviewing a Pull Request](/media/2020-02-24-githubclassroom/classroom-review-pull-request.gif)

## Student View: Merging the Pull Request / Branch

Ensure that students remember to merge their pull request (and, ultimately, their branch) into the master branch.  This will make it easier for you to find their work when you download their assignments.  By default, you'll see the master branch, and that will be empty if they only worked in an unmerged branch.  So, although branches are really useful in practice and to generate Pull Requests to get help, it's also helpful to merge them back into ``master`` before submitting.  My students sometimes forget to do this, and I see an empty directory at first when I clone!

![Merging a Pull Request](/media/2020-02-24-githubclassroom/classroom-merge-pull-request.gif)

## Downloading Assignments for Grading with the GitHub Classroom Assistant

![Downloading Assignments with GitHub Classroom Assistant](/media/2020-02-24-githubclassroom/assistant-download-assignment.gif)

# Closing Thoughts

GitHub Classroom is a useful tool to teach git in the classroom, and to manage student work among instructional staff and among peer student groups.  I've found a few tips and tricks in my workflow along the way, as you've seen above, but I've found this to help me manage student work in a meaningful industry platform.  I like when students develop best practices while doing their work: often, we're rushed to teach something and we forget to emphasize good habits along the way.

Finally, a few closing tips:

1. The repository names will start off with the name of the assignment (i.e., ``assignment1-ABC123``).  I like to set my assignment names/classroom names/assignment prefixes with the current semester/year (``csta-spring-2020-assignment1``).
2. I have Two Factor Authentication enabled on my github account, so I can’t check in files that GitHub Classroom Assistant downloads.  As you’ve seen, that could be OK, but I wrote scripts to download the SSH links for the class.  I am happy to share these if you are interested!
3. I like to create boilerplate “starter” assignments to house my instructions and starter work – although there are many steps here, most of them are “one-time” prep items that you do not have to repeat from year to year.  This way, I can focus instead on evolving the assignments!

------