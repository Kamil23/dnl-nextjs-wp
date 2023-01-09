import {
  EmailShareButton,
  EmailIcon,
  FacebookShareButton,
  FacebookIcon,
  PinterestShareButton,
  TwitterShareButton,
  WhatsappShareButton,
  PinterestIcon,
  WhatsappIcon,
  TwitterIcon,
} from "react-share";

const ShareBtns = ({ url, mediaUrl, title }) => {
  return (
    <div className="max-w-2xl mx-auto flex space-x-2">
      <WhatsappShareButton
        title={`dietanaluzie | ${title}. Przepis dostępny jest na blogu Roksany: ${url}`}
        url={url}
      >
        <WhatsappIcon className="rounded" />
      </WhatsappShareButton>
      <PinterestShareButton
        media={mediaUrl}
        description={`${title}. Przepis z bloga dietanaluzie, dostępny na stronie: ${url}`}
        url={url}
      >
        <PinterestIcon className="rounded" />
      </PinterestShareButton>
      <EmailShareButton
        subject={`Przepis dietanaluzie: ${url}`}
        body={`Hej! Sprawdź przepis Roksany z dietanaluzie: ${url}`}
        url={url}
      >
        <EmailIcon className="rounded" />
      </EmailShareButton>
      <FacebookShareButton
        quote={`Przepis dietanaluzie: ${url}`}
        hashtag="dietanaluzie"
        url={url}
      >
        <FacebookIcon className="rounded" />
      </FacebookShareButton>
      <TwitterShareButton
        title={`dietanaluzie | ${title}`}
        hashtags={["dietanaluzie", "przepis", "blog", "gotowanie"]}
        url={url}
      >
        <TwitterIcon className="rounded" />
      </TwitterShareButton>
    </div>
  );
};

export default ShareBtns;
