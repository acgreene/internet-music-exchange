# designer-pages

The shared contract for designer pages — the typed payload the API renders and
the `postMessage` protocol between the trusted host and an untrusted, sandboxed
design. Both the client host (`@ime/client-designer-pages`) and the API render
service (`@ime/api-designer-pages`) build against these types. Imported via
`@ime/designer-pages`.
