@_docs/agents.md @_docs/project-structure.md


I want to drastically refactor the project: now we have 4 different sections wiki, snippets, assets and drawings, I want to unify and integrate as much as possible, introduce the following concepts:
 - document: everything is a document, a markdown, a snippet a diagram, an image a generic file
 - renderer: js feature to show a specific type of document
 - view: is a perspective to see the contents of a wiki/folder
  
Some details:
 - Instead of having different separated contexts, introduce the concept of a render, so to show a markdown use the markdown renderer
 - each renderer has by default a view mode, and could have an edit mode
 - the renderer is driven by the concept of document type (different from content type), for example a snippet doc type has an expiration 
 -
