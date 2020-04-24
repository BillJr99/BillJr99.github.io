---
layout: archive
title: "Publications"
permalink: /publications/
author_profile: true
---

{% if site.author.googlescholar %}
  You can also find my articles on <u><a href="https://scholar.google.com/citations?user={{site.author.googlescholar}}">my Google Scholar profile</a>.</u>
{% endif %}

{% if site.author.dblp or site.author.csauthors %}
BibTeX Records for most publications can be found on: {% if site.author.dblp %}
[DBLP](https://dblp.uni-trier.de/pers/tb1/{{ site.author.dblp }}.bib) {% endif %}{% if site.author.csauthors %}[CSAuthors](https://www.csauthors.net/{{ site.author.csauthors }}/{{ site.author.csauthors }}.bib) {% endif %}
{% endif %}

{% include base_path %}

{% for post in site.publications reversed %}
  {% include archive-single.html %}
{% endfor %}
