import { parseISO, format } from "date-fns";
import { pl } from "date-fns/locale";

export default function Date({ dateString }) {
  const date = parseISO(dateString);
  return (
    <time dateTime={dateString}>
      {format(date, "d LLLL yyyy", { locale: pl })}
    </time>
  );
}
