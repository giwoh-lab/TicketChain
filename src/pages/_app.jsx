import '../styles/style.css'; // Global stylesheet for the prototype UI

/**
 * Custom App component required by Next.js when importing a global CSS file.
 */
export default function MyApp({ Component, pageProps }) {
  return <Component {...pageProps} />;
}

