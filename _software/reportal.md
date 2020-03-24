---
title: "REportal 2.0"
excerpt: "A Service-Based Reverse Engineering Portal"
collection: software
comments: true
tags:
  - reportal
  - software  
---

REportal[^1] is a central repository for reverse engineering tools.	REportal contains a compresensive set of reverse engineering tools to profile and data mine source code and software systems.

[REportal](https://www.cs.drexel.edu/~spiros/teaching/CS675/slides/reportalTechReport.pdf) was re-architected to provide a Service-Oriented Architecture (SOA) above useful reverse engineering and software source/architecture visualization tools such as [Chava](https://www.cs.drexel.edu/~spiros/teaching/CS675/slides/chava.pdf), [Ciao](https://www.program-transformation.org/Transform/CIAO), and [Bunch](https://www.cs.drexel.edu/~spiros/bunch/).

REportal works by exposing platform-specific tools as a web service interface, that then wraps the underlying API or command line interface of the tool itself.  These tools are then integrated in a contextual way through the web portal: for example, a visualization of a software system's class architecture can be linked to a source browser, or to source code metrics; these tools are configured to operate on the user's project automatically, providing a consistent interface to the user.  REportal featured the following services:

![REportal Services](/media/software-reportal/reportal-services.png "REportal Services")

Many of these tools provide static anslysis services; however, dynamic analysis was also provided through the automatic generation of Aspects.  Aspects were chosen by the user and then automatically compiled into the user's software system.  The user could then execute the software and provide REportal with the Aspect report output for visualization.

![Dynamic Analysis through Automatic Aspect Instrumentation](/media/software-reportal/DynamicAnalysis.png "REportal Dynamic Analysis Service")

Information about the development of the portal can be found in my [Masters Thesis](/publication/msthesis) and in [this paper](/publication/icpc2008) describing the architecture. 

I also developed auxiliary tools for visualization of software architecture, including [ClusterNav](/software/clusternav/) for visualization of [Bunch](https://www.cs.drexel.edu/~spiros/bunch/) clustered Module Dependency Graphs (MDG), and [xml2dot](/software/xml2dot/) for visualization of xml graph structures.  

ClusterNav was integrated into REportal, enabling automatic expansion and collapse of the computed software architecture clusters.  Clusters (octagons) can be expanded into their rectangular groups of artifacts, and are color-coded according to their relative weight.  

![Sample MDG viewed in ClusterNav](/media/software-reportal/TAPexpanded-mdg.png "Sample MDG viewed in ClusterNav")

These MDG visualizations can be filtered in interesting ways; for example, by generating a reachability query that shows the transitive "reach" of a particular software module, including function invocations or variable usage.

![Reachability Query](/media/software-reportal/ReachGraphical.png "Reachability Query")

Static reports such as code quality metrics and a hyperlinked source browser are also available.

![Source Metrics](/media/software-reportal/Metrics.png "Source Code Metrics")

![Source Code Browser](/media/software-reportal/SourceBrowser.png "Source Code Browser")

[^1]: REportal is served at [https://reportal.cs.drexel.edu](https://reportal.cs.drexel.edu), but may be in a retired state.

# Publications
<ul>{% for post in site.publications reversed %}
  {% if post.tags contains "reportal" %}
    {% include archive-single-cv.html %}
  {% endif %}
{% endfor %}</ul>

# Talks
<ul>{% for post in site.talks reversed %}
  {% if post.tags contains "reportal" %}
    {% include archive-single-talk-cv.html %}
  {% endif %}
{% endfor %}</ul>