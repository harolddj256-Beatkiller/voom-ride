import React, { useState } from 'react';
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { C } from './theme';
import { useSession } from './session';

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
  return (
    <View style={styles.roleRow}>
      {['RIDER', 'DRIVER'].map((r) => (
        <TouchableOpacity key={r} style={[styles.rolePill, role === r && styles.rolePillActive]} onPress={() => setRole(r)}>
          <Text style={[styles.roleText, role === r && styles.roleTextActive]}>{r === 'RIDER' ? 'Ride' : 'Drive'}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function EmailAuth({ mode, role, vehicleModel, setVehicleModel, vehiclePlate, setVehiclePlate }) {
  const { register, login } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      if (mode === 'signup') {
        await register({ name, email, password, role, vehicleModel, vehiclePlate });
      } else {
        await login({ email, password });
      }
    } catch (e) {
      Alert.alert(mode === 'signup' ? 'Could not create account' : 'Could not sign in', e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      {mode === 'signup' && <Field label="Full name" value={name} onChangeText={setName} autoCapitalize="words" />}
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
      {mode === 'signup' && role === 'DRIVER' && (
        <>
          <Field label="Vehicle model" value={vehicleModel} onChangeText={setVehicleModel} placeholder="e.g. Toyota Corolla" />
          <Field label="Plate number" value={vehiclePlate} onChangeText={setVehiclePlate} autoCapitalize="characters" />
        </>
      )}
      <Button disabled={busy || !email || !password || (mode === 'signup' && !name)} onPress={submit}>
        {busy ? <ActivityIndicator color={C.paper} /> : mode === 'signup' ? 'Create account' : 'Sign in'}
      </Button>
    </View>
  );
}

function PhoneAuth({ mode, role, vehicleModel, vehiclePlate }) {
  const { sendOtp, verifyOtp } = useSession();
  const [phone, setPhone] = useState('+251');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function requestCode() {
    setBusy(true);
    try {
      await sendOtp(phone.trim());
      setSent(true);
    } catch (e) {
      Alert.alert('Could not send code', e.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmCode() {
    setBusy(true);
    try {
      await verifyOtp({ phone: phone.trim(), code: code.trim(), role, name, vehicleModel, vehiclePlate });
    } catch (e) {
      Alert.alert('Could not verify code', e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      <Field label="Phone number (E.164, e.g. +2519xxxxxxxx)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" editable={!sent} />
      {!sent && mode === 'signup' && <Field label="Full name" value={name} onChangeText={setName} autoCapitalize="words" />}
      {!sent && (
        <Button disabled={busy || phone.trim().length < 8} onPress={requestCode}>
          {busy ? <ActivityIndicator color={C.paper} /> : 'Send code'}
        </Button>
      )}
      {sent && (
        <>
          <Field label="6-digit code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
          <Button disabled={busy || code.trim().length !== 6} onPress={confirmCode}>
            {busy ? <ActivityIndicator color={C.paper} /> : 'Verify and continue'}
          </Button>
          <TouchableOpacity onPress={() => setSent(false)} style={{ marginTop: 10 }}>
            <Text style={styles.link}>Use a different number</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

export default function AuthScreen() {
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
          <Text style={styles.logo}>VOOM</Text>
          <Text style={styles.title}>{mode === 'signup' ? 'Create your account' : 'Welcome back'}</Text>
          {mode === 'signup' && <RoleToggle role={role} setRole={setRole} />}
          <View style={styles.methodRow}>
            <TouchableOpacity style={[styles.methodPill, method === 'email' && styles.methodPillActive]} onPress={() => setMethod('email')}>
              <Text style={[styles.methodText, method === 'email' && styles.methodTextActive]}>Email</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.methodPill, method === 'phone' && styles.methodPillActive]} onPress={() => setMethod('phone')}>
              <Text style={[styles.methodText, method === 'phone' && styles.methodTextActive]}>Phone</Text>
            </TouchableOpacity>
          </View>
          {method === 'email'
            ? <EmailAuth mode={mode} role={role} vehicleModel={vehicleModel} setVehicleModel={setVehicleModel} vehiclePlate={vehiclePlate} setVehiclePlate={setVehiclePlate} />
            : <PhoneAuth mode={mode} role={role} vehicleModel={vehicleModel} vehiclePlate={vehiclePlate} />}
          <TouchableOpacity onPress={() => setMode(mode === 'signup' ? 'login' : 'signup')} style={{ marginTop: 18 }}>
            <Text style={styles.link}>{mode === 'signup' ? 'Already have an account? Sign in' : "New to VOOM? Create an account"}</Text>
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
  roleTextActive: { color: C.voom },
  methodRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  methodPill: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: C.line, alignItems: 'center' },
  methodPillActive: { borderColor: C.ink, backgroundColor: '#F8FFE9' },
  methodText: { fontWeight: '700', color: C.muted },
  methodTextActive: { color: C.ink },
  field: { marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '800', color: C.muted, marginBottom: 6 },
  input: { height: 50, borderRadius: 12, backgroundColor: C.soft, paddingHorizontal: 14, fontSize: 15, fontWeight: '600', color: C.ink },
  button: { marginTop: 8, backgroundColor: C.ink, borderRadius: 14, minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonSecondary: { backgroundColor: C.paper, borderWidth: 1.5, borderColor: C.line },
  buttonText: { color: C.paper, fontSize: 16, fontWeight: '900' },
  buttonTextSecondary: { color: C.ink },
  link: { color: C.darkGreen, fontWeight: '800', textAlign: 'center' },
});
