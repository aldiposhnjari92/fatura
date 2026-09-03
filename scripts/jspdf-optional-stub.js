/*
  Stands in for jsPDF's optional rendering dependencies.

  jspdf's ESM build imports html2canvas, canvg and dompurify at the top of the
  module, not lazily — so all three are bundled whenever jsPDF is, whether or
  not anything calls them. They exist to serve `doc.html()` and SVG rasterising.
  src/lib/pdf.ts draws the invoice with the text, table and addImage APIs and
  never touches either path, so the three were 372 KB of parse work on the way
  to every "Shkarko PDF" and nothing else.

  Aliased to this in astro.config.mjs. If a future change starts calling
  doc.html() or addSvgAsImage, remove the aliases — those APIs will not fail
  loudly here, they will fail as a blank region in the PDF.
*/
export default {};
