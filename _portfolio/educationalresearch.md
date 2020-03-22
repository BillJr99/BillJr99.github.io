---
title: "Education Research and Engagement"
excerpt: "Education Research and Engagement"
collection: portfolio
comments: true
tags: 
  - education
---

When I'm not in the classroom, I work with students (especially at the undergraduate level) in a research lab where we work together on the project's critical path.  I have found so many exciting opportunities to teach computing just-in-time with the contextual grounding of answering questions through experimental science.

As a graduate student, I was as an [NSF GK-12 Fellow](http://www.drexelgk12.com/), working with teachers to integrate concepts from our research into classroom activities that bridge STEM and the arts and humanities.  In my faculty role, I was a member of the Drexel University [Center for the Advancement of STEM Teaching and Learning Excellence (CASTLE)](https://drexel.edu/castle/), working to research, implement, and assess experiential pedagogy with colleagues from across the university.

# Publications
<ul>{% for post in site.publications reversed %}
  {% if post.tags contains "education" %}
    {% include archive-single-cv.html %}
  {% endif %}
{% endfor %}</ul>

# Talks
<ul>{% for post in site.talks reversed %}
  {% if post.tags contains "education" %}
    {% include archive-single-talk-cv.html %}
  {% endif %}
{% endfor %}</ul>