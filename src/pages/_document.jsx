import Document, { Html, Head, Main, NextScript } from "next/document";

/**
 * Custom Document to include global <link> tags such as Google Fonts.
 * Next.js renders this only on the server side, avoiding the
 * "Do not add stylesheets using next/head" warning.
 */
class MyDocument extends Document {
  static async getInitialProps(ctx) {
    const initialProps = await Document.getInitialProps(ctx);
    return { ...initialProps };
  }

  render() {
    return (
      <Html>
        <Head>
          {/* Global font stylesheet – moved from pages/index.jsx */}
          <link
            href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Playfair+Display:wght@700&display=swap"
            rel="stylesheet"
          />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
