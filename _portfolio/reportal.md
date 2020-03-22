---
title: "REportal 2.0"
excerpt: "A Service-Based Reverse Engineering Portal"
collection: portfolio
comments: true
tags:
  - reportal
  - software  
---

[REportal](https://reportal.cs.drexel.edu) is a central repository for reverse engineering tools.	REportal contains a compresensive set of reverse engineering tools to profile and data mine source code and software systems.

Information about the development of the portal can be found in my [Masters Thesis](/publication/msthesis) and in [this paper](/publication/icpc2008) describing the architecture. 

I developed auxiliary tools for visualization of software architecture, including [ClusterNav](/portfolio/clusternav/) for visualization of [Bunch](https://www.cs.drexel.edu/~spiros/bunch/) clustered Module Dependency Graphs (MDG), and [xml2dot](/portfolio/xml2dot/) for visualization of xml graph structures.  

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