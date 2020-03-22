---
title: "Software Engineering Research"
excerpt: "Software Engineering Research"
collection: portfolio
comments: true
tags:
  - se
---

I was a member of the Software Engineering Research Group at Drexel University, where I worked on software reverse engineering systems to facilitate program comprehension of large as-built systems.  These systems were aggregated in a portal called [REportal](/software/reportal/), a Reverse Engineering Portal Website.

# Publications
<ul>{% for post in site.publications reversed %}
  {% if post.tags contains "se" %}
    {% include archive-single-cv.html %}
  {% endif %}
{% endfor %}</ul>

# Talks
<ul>{% for post in site.talks reversed %}
  {% if post.tags contains "se" %}
    {% include archive-single-talk-cv.html %}
  {% endif %}
{% endfor %}</ul>