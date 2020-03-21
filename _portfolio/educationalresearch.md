---
title: "Education Research"
excerpt: "Education Research"
collection: portfolio
comments: true
tags: 
  - education
---

When I'm not in the classroom, I work with students (especially at the undergraduate level) in a research lab where we work together on the project's critical path.  I have found so many exciting opportunities to teach computing just-in-time with the contextual grounding of answering questions through experimental science.

# Publications
{% for post in site.publications reversed %}
  {% if post.tags contains "education" %}
    {% include archive-single.html %}
  {% endif %}
{% endfor %}