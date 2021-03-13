---
title: 'Replit in the Classroom'
date: 2021-03-20
permalink: /posts/2021/03/replitclassroom/
tags:
  - csta
  - education
  - technical
---

In this workshop, we will explore opportunities to utilize [Replit](https://replit.com) in the classroom for both small classroom exercises and assignments.  We will integrate Replit projects with additional tools and techniques including GitHub Classroom and POGIL instructional methods.

## Using External Libraries 
Using Replit, you can add external library support with many languages.  For example, if you import a package, Replit will automatically download and import the corresponding library when you compile or run the project.  However, if you have your own custom library that you'd like to import, you can do this as well.

If you are using a Java project, you can upload a jar file to your project (in my example, I uploaded a file called [rsamath.jar](https://www.billmongan.com/Ursinus-CS173/files/asmt-minicrypto/rsamath.jar) to a directory called `lib`).  You will have to tell Replit how to compile your project with this library in your `CLASSPATH`, and we can do this by creating a configuration file within the project called `.replit`.  Add the following text to this file \[[^1]\]:

```
run = "export CLASSPATH=\".:lib/rsamath.jar\"; javac -d . Main.java; java Main"
```

This adds the jar to your classpath along with the current project directory, so that your Main.java can compile (in the main project directory) while also loading the library from the rsamath.jar file.  The remaining javac and java commands are the standard compilation and execution commands that replit would use by default. 

Here is an example project \[[^2]\] that computes a value and its modular inverse from prime number inputs:

<iframe height="600px" width="100%" src="https://repl.it/@BillJr99/MiniCrypto?lite=true" scrolling="no" frameborder="no" allowtransparency="true" allowfullscreen="true" sandbox="allow-forms allow-pointer-lock allow-popups allow-same-origin allow-scripts allow-modals"></iframe> 

### Database Access

While we're at it, Replit provides a key/value data store to each project that we can use to store those generated keys, in case you'd like some values to persist in between runs of a student's project.  Replit provides a few web API endpoints via an environment variable that it maintains for your project, including:

* `GET $REPL_DB_URL`: Insert a key and value into the datastore.  The data passed with the body of this HTTP request is `key=value`.
* `GET $REPL_DB_URL/key`: Retrieve the value associated with the key.
* `DELETE $REPL_DB_URL/key`: Delete the key from the datastore.

I have encapsulated these web calls \[[^3]\] into a class called `ReplDb` that are provided in the following example project:

<iframe height="600px" width="100%" src="https://repl.it/@BillJr99/MiniCryptoDb?lite=true" scrolling="no" frameborder="no" allowtransparency="true" allowfullscreen="true" sandbox="allow-forms allow-pointer-lock allow-popups allow-same-origin allow-scripts allow-modals"></iframe> 

## Version Control

Replit maintains a history of the revisions made to each project, but integrating with [git](https://git-scm.com/) provides an opportunity to teach the fundamentals and mechanics of version control.  Under the Version Control left menu of the Replit project page, you can create a git repository as follows:

![]({{ site.baseurl }}/files/media/2021-03-20-replitclassroom/versioncontrolsetup.png)

When the repository is created, you will see something like this:

![]({{ site.baseurl }}/files/media/2021-03-20-replitclassroom/versioncreated.png)

As you revise the project, you'll have an opportunity to click to create a new revision, including a log message, that you can use to revert your project to any commit that you've made.

![]({{ site.baseurl }}/files/media/2021-03-20-replitclassroom/versioncontrolrevision.png)

![]({{ site.baseurl }}/files/media/2021-03-20-replitclassroom/versioncontrolcommitted.png)

Finally, you can connect this repository to your [GitHub](https://github.com/) account.  This may not be appropriate for homework assignments so that they aren't inadvertantly made public (more on this below!), but is a nice way to create a public portfolio of independent study projects and final course projects.

![]({{ site.baseurl }}/files/media/2021-03-20-replitclassroom/connecttogithub.png)

## Using Graphics

Replit supports graphical displays through the browser!  You can download Robert Sedgewick's [algs4.jar](https://algs4.cs.princeton.edu/code/algs4.jar) library \[[^4]\] and add it to your project as we described above.  Running the project will display the output window as a frame within your web browser.  

![]({{ site.baseurl }}/files/media/2021-03-20-replitclassroom/graphics.png)

Here is an example project demonstrating this \[[^5]\].

<iframe height="600px" width="100%" src="https://repl.it/@BillJr99/StdDrawPrincetonExample?lite=true" scrolling="no" frameborder="no" allowtransparency="true" allowfullscreen="true" sandbox="allow-forms allow-pointer-lock allow-popups allow-same-origin allow-scripts allow-modals"></iframe> 

## Unit Testing

We will see later that you can add your own unit tests and input/output tests in order to autograde a Replit project, but you can encourage students to create their own unit tests, too.

Click the checkmark on the left menu, and click the setup button to initialize your tests.  It will prompt you to add these imports:

```java
import org.junit.Before;
import org.junit.After;
import org.junit.Test;
import static org.junit.Assert.*;
```

![]({{ site.baseurl }}/files/media/2021-03-20-replitclassroom/unittestsetup.png)

Then, click "Add Test" under the same checkmark menu.   Add your test code, for example:

![]({{ site.baseurl }}/files/media/2021-03-20-replitclassroom/unittestexample.png)

We will create the following test:

```java 
Main tester = new Main();
int result = tester.squareIt(-2);
 assertEquals(4, result);
```

![]({{ site.baseurl }}/files/media/2021-03-20-replitclassroom/unittestsquare.png)
  
Finally, click Run Tests under the checkmark menu for a report.  I have not found a way to export these tests for submission, but you could ask students to copy their test code snippets and a screenshot of their report for a low-tech solution.

Here is a quick example project demonstrating how to create and run a unit test:

<iframe height="600px" width="100%" src="https://repl.it/@BillJr99/JUnitExample?lite=true" scrolling="no" frameborder="no" allowtransparency="true" allowfullscreen="true" sandbox="allow-forms allow-pointer-lock allow-popups allow-same-origin allow-scripts allow-modals"></iframe> 

## Code Formatting

My students often miss the "auto-format" button on their Replit projects.  This is a nice way to clean up things like indentation, and to demonstrate best practices.  The button is located on the top right of the code window for the project.

![]({{ site.baseurl }}/files/media/2021-03-20-replitclassroom/autoformat.png)

## Pair Programming

Another often overlooked feature is project sharing functionality.  Click the "Share" button on the top left of the Replit project to invite other users to pair program with you simultaneously.  Note that this button might disappear if an ad-blocker plugin is used on the browser.

![]({{ site.baseurl }}/files/media/2021-03-20-replitclassroom/share.png)

## Embedding Replit into POGIL Style Activities
In my classes, I use a [POGIL](https://cspogil.org/Home) style method to facilitate class discussion.  Instead of lecture notes, each class features some guiding questions, as well as some examples or materials to spark some curiosity and discussion.  As you have seen in this article, I also embed Replit project examples that students can view, fork, modify, and share with me from within the activity page.  You can do this by embedding an `iframe` in your web pages with a `src` tag indicating your Replit project URL (with `?lite=true` at the end of the URL), as follows:

```
<iframe height="600px" width="100%" src="https://repl.it/@BillJr99/MiniCrypto?lite=true" scrolling="no" frameborder="no" allowtransparency="true" allowfullscreen="true" sandbox="allow-forms allow-pointer-lock allow-popups allow-same-origin allow-scripts allow-modals"></iframe> 
```

There is a button at the top right of the frame to open the example in a new browser tab.  Here is an [example lesson](https://www.billmongan.com/Ursinus-CS173-Spring2021/Activities/Conditionals3).

## Integrating Replit with GitHub Classroom

In addition to creating a version control repository, you can configure your assignments to automatically create repositories linked to your students' Replit projects that are shared with you for grading and auto-grading.  One nice feature of [GitHub Classroom](https://classroom.github.com/) integration is that you can configure these repositories to be private (although making the underlying Replit projects private may require a paid subscription).  I created a short video demonstrating how to set this up in a [prior article](/posts/2020/08/replitgithubclassroom/).  

<iframe width="560" height="315" src="https://www.youtube.com/embed/9gzm2MS4DHg" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
------

[^1]: https://replit.com/talk/ask/Jar-files/21299
[^2]: https://www.billmongan.com/Ursinus-CS173/Assignments/MiniCrypto
[^3]: https://www.baeldung.com/java-http-request
[^4]: https://introcs.cs.princeton.edu/java/stdlib/
[^5]: https://www.billmongan.com/Ursinus-CS173/Assignments/Faces