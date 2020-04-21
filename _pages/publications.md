---
layout: archive
title: "Publications"
permalink: /publications/
author_profile: true
---

{% if site.author.googlescholar %}
  You can also find my articles on <u><a href="https://scholar.google.com/citations?user={{author.googlescholar}}">my Google Scholar profile</a>.</u>
{% endif %}

BibTeX Records for most publications can be found on: {% if site.author.dblp %}the 
[DBLP](https://dblp.uni-trier.de/pers/tb1/{{ site.author.dblp }}.bib) {% endif %}{% if site.author.csauthors %}[CSAuthors](https://www.csauthors.net/{{ site.author.csauthors }}/{{ site.author.csauthors }}.bib) {% endif %}{% if site.author.googlescholar %}[Google Scholar](https://scholar.googleusercontent.com/citations?view_op=export_citations&user={{ site.author.googlescholar }}&citsig=AMD79ooAAAAAXqDB9Md9_ju11m0O46ZMg6g9CJVYej73){% endif %}

{% include base_path %}

{% for post in site.publications reversed %}
  {% include archive-single.html %}
{% endfor %}
