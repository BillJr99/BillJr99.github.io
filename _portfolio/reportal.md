---
title: "REportal 2.0"
excerpt: "A Service-Based Reverse Engineering Portal"
collection: portfolio
comments: true
tags:
  - reportal
---

[REportal](https://reportal.cs.drexel.edu) is a central repository for reverse engineering tools.	REportal contains a compresensive set of reverse engineering tools to profile and data mine source code and software systems.

Information about the development of the portal can be found in my [Masters Thesis](/publication/msthesis) and in [this paper](/publication/icpc2008) describing the architecture. 

# Publications
{% for post in site.publications reversed %}
  {% if post.tags contains "reportal" %}
    {% include archive-single.html %}
  {% endif %}
{% endfor %}