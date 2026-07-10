type JsonViewerProps = {
  data: unknown;
};

function JsonViewer({ data }: JsonViewerProps) {
  return <pre className="json-viewer">{JSON.stringify(data, null, 2)}</pre>;
}

export { JsonViewer };
export default JsonViewer;