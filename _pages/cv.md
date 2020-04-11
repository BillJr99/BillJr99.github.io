---
layout: archive
title: "CV"
permalink: /cv/
author_profile: true
redirect_from:
  - /resume
---

{% include base_path %}

My Full CV can be found [here](/files/CV.pdf)    
View My Scholarly Activity using the left-hand or 'Follow' navigation menu.  
  
[ORCID CV]({{ site.author.orcid }}/print)

[NCBI SciEnv](https://www.ncbi.nlm.nih.gov/sciencv/) Biosketches:
* [NIH Biosketch](https://www.ncbi.nlm.nih.gov/myncbi/william.mongan.1/cv/313798/)
* [NSF Biosketch](https://www.ncbi.nlm.nih.gov/myncbi/william.mongan.1/cv/313815/)

Education
======
* Ph.D in Electrical and Computer Engineering, Drexel University, 2018
* M.S. in Computer Science, Drexel University, 2008
* M.S. in Science of Instruction, Drexel University, 2008
  * Pennsylvania Teaching Certification in Grades 7-12 Mathematics
* B.S. in Computer Science, Drexel University, 2005
  * Minor in Mathematics
  * Magna Cum Laude

Selected Faculty Appointments
======
* Assistant Professor (Visiting) of Math and Computer Science at Ursinus College, 2020-Present

* Instructor (Part-Time) of Computer Science and Engineering at Syracuse University, 2020-Present

* Associate Department Head of Undergraduate Affairs in the Department of Computer Science at Drexel University, 2014-2019
  * Associate Department Head, 2015-2019
  * Director of Undergraduate Affairs, 2014-2015

* Lecturer (Visiting) of Computer and Information Science at the University of Pennsylvania, 2011-2013

* Teaching Faculty of Computer Science at Drexel University, 2008-2019
  * Teaching Professor (full), 2017-2019
  * Associate Teaching Professor, 2012-2017
  * Assistant Teaching Professor, 2011-2012
  * Instructor / Auxiliary Professor, 2008-2011

Selected Publications
======
BibTeX Records for most publications can be found on the [DBLP](https://dblp.uni-trier.de/pers/tb1/{{ site.author.dblp }}.bib) and on [CSAuthors](https://www.csauthors.net/{{ site.author.csauthors }}/{{ site.author.csauthors }}.bib)

  <ul>{% for post in site.publications reversed %}
    {% include archive-single-cv.html %}
  {% endfor %}</ul>
  
Selected Talks
======
  <ul>{% for post in site.talks reversed %}
    {% include archive-single-talk-cv.html %}
  {% endfor %}</ul>
  
Selected Teaching
======
  <ul>{% for post in site.teaching reversed %}
    {% include archive-single-cv.html %}
  {% endfor %}</ul>
