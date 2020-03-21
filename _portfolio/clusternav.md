---
title: "ClusterNav"
excerpt: "Visualiztion of Bunch Clustered Software Module Dependency Graphs"
collection: portfolio
comments: true
tags:
  - reportal
  - technical
---

[ClusterNav](/files/clusternav.jar) is a GXL abstract visualizer for software dependency graphs. This tool requires the [Grappa](http://www.research.att.com/~john/Grappa/) package from [GraphViz](http://www.graphviz.org/), as well as the standard [xalan](https://xml.apache.org/xalan-j/) XML library.

Run the following for usage information:
`java -classpath clusternav.jar:grappa1_2.jar:$CLASSPATH clusternav.ClusterViewer` 