import { FaqAccordionItem } from "@/components/FaqAccordion";

export type PaymentFaqItem = { q: string; a: string };

export const PaymentFaq = ({ items }: { items: PaymentFaqItem[] }) => (
  <div className="ap-card" style={{ padding: "8px 28px" }}>
    {items.map((item) => (
      <FaqAccordionItem key={item.q} q={item.q} a={item.a} />
    ))}
  </div>
);
