import SocialShareButtons from "./share-buttons";

const ShareBtns = ({ url, mediaUrl, title }) => {
  return (
    <div className="max-w-2xl mx-auto flex space-x-2">
      <SocialShareButtons url={url} mediaUrl={mediaUrl} title={title} />
    </div>
  );
};

export default ShareBtns;
