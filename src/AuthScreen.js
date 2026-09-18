import React, { useState } from 'react';
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { C } from './theme';
import BekloLogo from './BekloLogo';
import { useSession } from './session';
import { useI18n } from './i18n';
import { captureIdentityPhoto } from './photoCapture';

function Field({ label, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor="#9AA098" {...props} />
    </View>
  );
}

function Button({ children, onPress, disabled, secondary }) {
  return (
    <TouchableOpacity
      activeOpacity={0.86}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, secondary && styles.buttonSecondary, disabled && { opacity: 0.5 }]}
    >
      <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{children}</Text>
    </TouchableOpacity>
  );
}

function RoleToggle({ role, setRole }) {
  const { t } = useI18n();
  return (
    <View style={styles.roleRow}>
      {['RIDER', 'DRIVER'].map((r) => (
        <TouchableOpacity key={r} style={[styles.rolePill, role === r && styles.rolePillActive]} onPress={() => setRole(r)}>
          <Text style={[styles.roleText, role === r && styles.roleTextActive]}>{r === 'RIDER' ? t('auth.roleRide') : t('auth.roleDrive')}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function PhotoField({ label, photo, takeLabel, retakeLabel, onCapture, disabled }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.photoButton} onPress={onCapture} disabled={disabled}>
        {photo ? <Image source={{ uri: photo }} style={styles.photoThumb} /> : <View style={styles.photoPlaceholder} />}
        <Text style={styles.photoButtonText}>{photo ? retakeLabel : takeLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

// Signup always collects both a verified phone (via OTP) and an email + password,
// so every Beklo account can be reached both ways. Drivers additionally submit a
// Fayda ID number and two photos so Beklo can review and verify them remotely.
function SignupForm({ role, vehicleModel, setVehicleModel, vehiclePlate, setVehiclePlate }) {
  const { t } = useI18n();
  const { register, sendOtp } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('+251');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [faydaNumber, setFaydaNumber] = useState('');
  const [selfiePhoto, setSelfiePhoto] = useState(null);
  const [idPhoto, setIdPhoto] = useState(null);
  const [capturing, setCapturing] = useState(false);

  const isDriver = role === 'DRIVER';
  const identityValid = !isDriver || (faydaNumber.replace(/\D/g, '').length === 12 && selfiePhoto && idPhoto);
  const detailsValid = name.trim().length >= 2 && email.trim().length > 3 && password.length >= 8 && phone.trim().length >= 8 && identityValid;

  async function capture(setPhoto) {
    setCapturing(true);
    try {
      const photo = await captureIdentityPhoto(t('auth.cameraDeniedMessage'));
      if (photo) setPhoto(photo);
    } catch (e) {
      Alert.alert(t('auth.couldNotCapturePhoto'), e.message);
    } finally {
      setCapturing(false);
    }
  }

  async function requestCode() {
    setBusy(true);
    try {
      await sendOtp(phone.trim());
      setSent(true);
    } catch (e) {
      Alert.alert(t('auth.couldNotSendCode'), e.message);
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    try {
      await register({
        name, email, password, phone: phone.trim(), code: code.trim(), role, vehicleModel, vehiclePlate,
        ...(isDriver ? { faydaNumber: faydaNumber.replace(/\D/g, ''), selfiePhoto, idPhoto } : {}),
      });
    } catch (e) {
      Alert.alert(t('auth.couldNotCreateAccount'), e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      <Field label={t('auth.fullName')} value={name} onChangeText={setName} autoCapitalize="words" editable={!sent} />
      <Field label={t('auth.emailLabel')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" editable={!sent} />
      <Field label={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry editable={!sent} />
      {isDriver && (
        <>
          <Field label={t('auth.vehicleModel')} value={vehicleModel} onChangeText={setVehicleModel} placeholder={t('auth.vehicleModelPlaceholder')} editable={!sent} />
          <Field label={t('auth.plateNumber')} value={vehiclePlate} onChangeText={setVehiclePlate} autoCapitalize="characters" editable={!sent} />
          <Field label={t('auth.faydaNumber')} value={faydaNumber} onChangeText={setFaydaNumber} keyboardType="number-pad" placeholder={t('auth.faydaNumberPlaceholder')} maxLength={12} editable={!sent} />
          <Text style={styles.hint}>{t('auth.identityNote')}</Text>
          <PhotoField label={t('auth.selfiePhoto')} photo={selfiePhoto} takeLabel={t('auth.takeSelfie')} retakeLabel={t('auth.retakeSelfie')} disabled={sent || capturing} onCapture={() => capture(setSelfiePhoto)} />
          <PhotoField label={t('auth.idPhoto')} photo={idPhoto} takeLabel={t('auth.takeIdPhoto')} retakeLabel={t('auth.retakeIdPhoto')} disabled={sent || capturing} onCapture={() => capture(setIdPhoto)} />
        </>
      )}
      <Field label={t('auth.phoneLabel')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" editable={!sent} />
      {!sent && <Text style={styles.hint}>{t('auth.verifyPhoneFirst')}</Text>}
      {!sent && (
        <Button disabled={busy || capturing || !detailsValid} onPress={requestCode}>
          {busy ? <ActivityIndicator color={C.paper} /> : t('auth.sendCode')}
        </Button>
      )}
      {sent && (
        <>
          <Field label={t('auth.codeLabel')} value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
          <Button disabled={busy || code.trim().length !== 6} onPress={submit}>
            {busy ? <ActivityIndicator color={C.paper} /> : t('auth.createAccountButton')}
          </Button>
          <TouchableOpacity onPress={() => { setSent(false); setCode(''); }} style={{ marginTop: 10 }}>
            <Text style={styles.link}>{t('auth.useDifferentNumber')}</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

function EmailLogin() {
  const { t } = useI18n();
  const { login } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await login({ email, password });
    } catch (e) {
      Alert.alert(t('auth.couldNotSignIn'), e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      <Field label={t('auth.emailLabel')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Field label={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry />
      <Button disabled={busy || !email || !password} onPress={submit}>
        {busy ? <ActivityIndicator color={C.paper} /> : t('auth.signIn')}
      </Button>
    </View>
  );
}

function PhoneLogin() {
  const { t } = useI18n();
  const { sendOtp, verifyOtp } = useSession();
  const [phone, setPhone] = useState('+251');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function requestCode() {
    setBusy(true);
    try {
      await sendOtp(phone.trim());
      setSent(true);
    } catch (e) {
      Alert.alert(t('auth.couldNotSendCode'), e.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmCode() {
    setBusy(true);
    try {
      await verifyOtp({ phone: phone.trim(), code: code.trim() });
    } catch (e) {
      Alert.alert(t('auth.couldNotVerifyCode'), e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      <Field label={t('auth.phoneLabel')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" editable={!sent} />
      {!sent && (
        <Button disabled={busy || phone.trim().length < 8} onPress={requestCode}>
          {busy ? <ActivityIndicator color={C.paper} /> : t('auth.sendCode')}
        </Button>
      )}
      {sent && (
        <>
          <Field label={t('auth.codeLabel')} value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
          <Button disabled={busy || code.trim().length !== 6} onPress={confirmCode}>
            {busy ? <ActivityIndicator color={C.paper} /> : t('auth.verifyAndContinue')}
          </Button>
          <TouchableOpacity onPress={() => setSent(false)} style={{ marginTop: 10 }}>
            <Text style={styles.link}>{t('auth.useDifferentNumber')}</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

export default function AuthScreen() {
  const { t } = useI18n();
  const [mode, setMode] = useState('login');
  const [method, setMethod] = useState('email');
  const [role, setRole] = useState('RIDER');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <BekloLogo size={44} style={{ marginBottom: 6 }} />
          <Text style={styles.title}>{mode === 'signup' ? t('auth.createAccount') : t('auth.welcomeBack')}</Text>
          {mode === 'signup' && <RoleToggle role={role} setRole={setRole} />}
          {mode === 'signup' ? (
            <SignupForm role={role} vehicleModel={vehicleModel} setVehicleModel={setVehicleModel} vehiclePlate={vehiclePlate} setVehiclePlate={setVehiclePlate} />
          ) : (
            <>
              <View style={styles.methodRow}>
                <TouchableOpacity style={[styles.methodPill, method === 'email' && styles.methodPillActive]} onPress={() => setMethod('email')}>
                  <Text style={[styles.methodText, method === 'email' && styles.methodTextActive]}>{t('auth.email')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.methodPill, method === 'phone' && styles.methodPillActive]} onPress={() => setMethod('phone')}>
                  <Text style={[styles.methodText, method === 'phone' && styles.methodTextActive]}>{t('auth.phone')}</Text>
                </TouchableOpacity>
              </View>
              {method === 'email' ? <EmailLogin /> : <PhoneLogin />}
            </>
          )}
          <TouchableOpacity onPress={() => setMode(mode === 'signup' ? 'login' : 'signup')} style={{ marginTop: 18 }}>
            <Text style={styles.link}>{mode === 'signup' ? t('auth.alreadyHaveAccount') : t('auth.newToVoom')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },
  flex: { flex: 1 },
  scroll: { padding: 24, paddingTop: 60, paddingBottom: 40 },
  logo: { color: C.ink, fontSize: 30, fontWeight: '900', letterSpacing: -1.6 },
  title: { fontSize: 22, fontWeight: '900', color: C.ink, marginTop: 18, marginBottom: 14 },
  roleRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  rolePill: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: C.soft, alignItems: 'center' },
  rolePillActive: { backgroundColor: C.ink },
  roleText: { fontWeight: '800', color: C.ink },
  roleTextActive: { color: C.paper },
  methodRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  methodPill: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: C.line, alignItems: 'center' },
  methodPillActive: { borderColor: C.ink, backgroundColor: C.brandSoft },
  methodText: { fontWeight: '700', color: C.muted },
  methodTextActive: { color: C.ink },
  photoButton: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 56, borderRadius: 12, backgroundColor: C.soft, paddingHorizontal: 10 },
  photoThumb: { width: 40, height: 40, borderRadius: 8 },
  photoPlaceholder: { width: 40, height: 40, borderRadius: 8, backgroundColor: C.line },
  photoButtonText: { fontWeight: '800', color: C.ink },
  field: { marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '800', color: C.muted, marginBottom: 6 },
  input: { height: 50, borderRadius: 12, backgroundColor: C.soft, paddingHorizontal: 14, fontSize: 15, fontWeight: '600', color: C.ink },
  hint: { fontSize: 12, color: C.muted, marginBottom: 12, lineHeight: 17 },
  button: { marginTop: 8, backgroundColor: C.brand, borderRadius: 14, minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonSecondary: { backgroundColor: C.paper, borderWidth: 1.5, borderColor: C.line },
  buttonText: { color: C.ink, fontSize: 16, fontWeight: '900' },
  buttonTextSecondary: { color: C.ink },
  link: { color: C.ink, fontWeight: '800', textAlign: 'center' },
});
