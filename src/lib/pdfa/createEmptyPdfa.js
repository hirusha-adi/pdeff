export function createEmptyPdfa(source) {
  const now = new Date().toISOString();
  return {
    format: "offline-pdf-annotator-pdfa",
    version: 1,
    source,
    documentState: {
      lastOpenedPage: 1,
      zoom: 1,
      scrollTop: 0
    },
    annotations: [],
    commentThreads: [],
    updatedAt: now
  };
}
