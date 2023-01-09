import Alert from "./alert";
import Footer from "./footer";
import Intro from "./intro";
import Meta from "./meta";

export default function Layout({ preview, menu, children }) {
  return (
    <>
      <Meta />
      <div className="min-h-screen">
        <Alert preview={preview} />
        <Intro menu={menu} />
        <main>{children}</main>
      </div>
      <Footer />
    </>
  );
}