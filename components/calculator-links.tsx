import Link from "next/link";
import { otherCalculators } from "../lib/calculators";

// "Inne kalkulatory" cross-link block shown at the bottom of every calculator
// page. Internal linking between the tools helps them rank as a cluster.
export default function CalculatorLinks({ current }: { current: string }) {
  const others = otherCalculators(current);
  return (
    <div className="mt-14 border-t border-gray-100 pt-8">
      <p className="text-sm text-gray-500 mb-3">Inne kalkulatory:</p>
      <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
        {others.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/${c.slug}/`}
              className="text-sm text-gray-700 hover:text-gray-900 hover:underline underline-offset-2"
            >
              {c.emoji} {c.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
