'use strict';
// A driver may only see and take ride requests after an admin has checked
// their Fayda ID and photos (verificationStatus === 'VERIFIED').
function driverBlockReason(user) {
  if (!user || user.role !== 'DRIVER') return 'Not allowed for this account type.';
  if (user.verificationStatus === 'VERIFIED') return null;
  if (user.verificationStatus === 'REJECTED') return 'Your driver verification was rejected. Contact support.';
  return 'Your driver ID is still being reviewed. You can take rides once it is approved.';
}

module.exports = { driverBlockReason };
