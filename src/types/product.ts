export type Product = {
  id: string;
  code: string;
  name: string;
  description?: string;
  brand?: string;
  category?: string;
  image?: string; // 👈 base64
  createdAt?: string;
};
