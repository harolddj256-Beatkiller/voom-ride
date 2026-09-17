// Builds a wa.me deep link that opens WhatsApp with a specific number and a
// prefilled message, so a rider can send trip details in one tap instead of
// going through the generic OS share sheet.
function whatsappShareURL(number, message) {
  const digits = String(number).replace(/[^\d]/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
module.exports = { whatsappShareURL };
