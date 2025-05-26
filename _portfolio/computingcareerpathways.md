---
title: "Computing Career Pathways"
excerpt: "Exploring the Breadth of Computing Careers and Pathways"
collection: portfolio
comments: true
tags:
  - computingcareerpathways
---

In collaboration with the Pennsylvania Department of Education Bureau of Special Education, I am developing materials and interviews to serve as a toolkit for K-12 students, teachers, and parents to explore the breadth of computing and the many career pathways that lead there.  I produce and host the [Digital Signature Podcast](https://www.digitalsignature.fm) to make these materials broadly available to the community, which is available on my [Youtube channel](https://www.digitalsignature.tv) and as a [Spotify podcast](https://open.spotify.com/show/6XDlNn8O74YGZlNeOmpxlV) via [Anchor.fm](https://anchor.fm/william-mongan).

# Publications
<ul>{% for post in site.publications reversed %}
  {% if post.tags contains "computingcareerpathways" %}
    {% include archive-single-cv.html %}
  {% endif %}
{% endfor %}</ul>

# Talks
<ul>{% for post in site.talks reversed %}
  {% if post.tags contains "computingcareerpathways" %}
    {% include archive-single-talk-cv.html %}
  {% endif %}
{% endfor %}</ul>