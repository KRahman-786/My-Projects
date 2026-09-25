export const SITE = {
  name: 'Kashif Collection',
  tagline: 'Cosmetics · Lace · Artificial Jewellery',
  description:
    'Kashif Collection, Shahjahanpur — shop premium cosmetics, designer laces and artificial jewellery online. Genuine products, COD available, fast delivery across India.',
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  address: { street: 'Near Eidgah, Kamran Market', city: 'Shahjahanpur', state: 'Uttar Pradesh', pincode: '242001', country: 'IN' },
  phone: '+91 90000 00000',
  whatsapp: '919000000000',
  email: 'support@kashifcollection.in',
  hours: 'Mon–Sat, 10:00 AM – 8:00 PM',
};

export const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];
