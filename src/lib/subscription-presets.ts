export interface SubscriptionPreset {
  name: string;
  emoji: string;
  color: string;
  amount: number;
  currency: string;
  billing_cycle: "monthly" | "yearly";
  categoryHint: string; // matches category name (case-insensitive)
}

export const SUBSCRIPTION_PRESETS: SubscriptionPreset[] = [
  { name: "Netflix",          emoji: "🎬", color: "#E50914", amount: 13.99, currency: "EUR", billing_cycle: "monthly", categoryHint: "Streaming" },
  { name: "Spotify",          emoji: "🎵", color: "#1DB954", amount: 10.99, currency: "EUR", billing_cycle: "monthly", categoryHint: "Música" },
  { name: "Disney+",          emoji: "🏰", color: "#113CCF", amount: 9.99,  currency: "EUR", billing_cycle: "monthly", categoryHint: "Streaming" },
  { name: "HBO Max",          emoji: "🎭", color: "#9B4DFF", amount: 9.99,  currency: "EUR", billing_cycle: "monthly", categoryHint: "Streaming" },
  { name: "Amazon Prime",     emoji: "📦", color: "#00A8E1", amount: 4.99,  currency: "EUR", billing_cycle: "monthly", categoryHint: "Streaming" },
  { name: "Apple Music",      emoji: "🎶", color: "#FA243C", amount: 10.99, currency: "EUR", billing_cycle: "monthly", categoryHint: "Música" },
  { name: "YouTube Premium",  emoji: "▶️", color: "#FF0000", amount: 11.99, currency: "EUR", billing_cycle: "monthly", categoryHint: "Streaming" },
  { name: "iCloud+",          emoji: "☁️", color: "#3693F3", amount: 2.99,  currency: "EUR", billing_cycle: "monthly", categoryHint: "Cloud" },
  { name: "Google One",       emoji: "🌐", color: "#4285F4", amount: 1.99,  currency: "EUR", billing_cycle: "monthly", categoryHint: "Cloud" },
  { name: "Dropbox",          emoji: "📁", color: "#0061FF", amount: 11.99, currency: "EUR", billing_cycle: "monthly", categoryHint: "Cloud" },
  { name: "Microsoft 365",    emoji: "📊", color: "#D83B01", amount: 7.00,  currency: "EUR", billing_cycle: "monthly", categoryHint: "Produtividade" },
  { name: "Notion",           emoji: "📝", color: "#000000", amount: 9.50,  currency: "EUR", billing_cycle: "monthly", categoryHint: "Produtividade" },
  { name: "ChatGPT Plus",     emoji: "🤖", color: "#10A37F", amount: 22.00, currency: "EUR", billing_cycle: "monthly", categoryHint: "Produtividade" },
  { name: "Adobe Creative",   emoji: "🎨", color: "#FF0000", amount: 59.99, currency: "EUR", billing_cycle: "monthly", categoryHint: "Produtividade" },
  { name: "GitHub",           emoji: "🐙", color: "#181717", amount: 4.00,  currency: "EUR", billing_cycle: "monthly", categoryHint: "Produtividade" },
  { name: "PlayStation Plus", emoji: "🎮", color: "#0070D1", amount: 8.99,  currency: "EUR", billing_cycle: "monthly", categoryHint: "Jogos" },
  { name: "Xbox Game Pass",   emoji: "🕹️", color: "#107C10", amount: 12.99, currency: "EUR", billing_cycle: "monthly", categoryHint: "Jogos" },
  { name: "Nintendo Online",  emoji: "👾", color: "#E60012", amount: 3.99,  currency: "EUR", billing_cycle: "monthly", categoryHint: "Jogos" },
  { name: "Ginásio",          emoji: "💪", color: "#F59E0B", amount: 29.99, currency: "EUR", billing_cycle: "monthly", categoryHint: "Saúde" },
  { name: "Outro",            emoji: "✨", color: "#6B7280", amount: 0,     currency: "EUR", billing_cycle: "monthly", categoryHint: "" },
];
