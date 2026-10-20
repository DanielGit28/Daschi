import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { colors } from '../lib/theme';

// Pelaje un poco más claro que el fondo y con borde, para que se lea sobre tarjetas oscuras.
const COAT = '#3B3942';
const COAT_FAR = '#2E2C34';
const OUTLINE = '#55535C';
const SPOT_GREY = '#8C8F97';
const TAN_FAR = '#A86C38';
const NOSE = '#0B0B0D';

/**
 * Salchicha arlequín (como Olivia): pelaje carbón con manchas gris plata y blanco hueso,
 * y puntas café en hocico, cejas, pecho y patitas. Dibujada de perfil mirando a la derecha.
 */
export function Mascot({ size = 120 }: { size?: number }) {
  return (
    <Svg width={size} height={(size * 130) / 220} viewBox="0 0 220 130" accessibilityLabel="Salchicha arlequín">
      <Ellipse cx={110} cy={121} rx={78} ry={6} fill="#000" opacity={0.35} />

      {/* cola y patas */}
      <Path d="M44 62 C 26 56, 18 40, 22 26" stroke={COAT} strokeWidth={9} strokeLinecap="round" fill="none" />
      <G stroke={OUTLINE} strokeWidth={1.5}>
        <Rect x={71} y={78} width={15} height={36} rx={7} fill={COAT_FAR} />
        <Rect x={128} y={78} width={15} height={36} rx={7} fill={COAT_FAR} />
        <Rect x={52} y={78} width={15} height={36} rx={7} fill={COAT} />
        <Rect x={147} y={78} width={15} height={36} rx={7} fill={COAT} />
      </G>
      <Rect x={71} y={101} width={15} height={13} rx={6} fill={TAN_FAR} />
      <Rect x={128} y={101} width={15} height={13} rx={6} fill={TAN_FAR} />
      <Rect x={52} y={101} width={15} height={13} rx={6} fill={colors.accent} />
      <Rect x={147} y={101} width={15} height={13} rx={6} fill={colors.accent} />

      {/* cuerpo largo con manchas */}
      <Rect x={38} y={44} width={132} height={48} rx={24} fill={COAT} stroke={OUTLINE} strokeWidth={1.5} />
      <Ellipse cx={70} cy={58} rx={12} ry={8} fill={SPOT_GREY} />
      <Ellipse cx={95} cy={74} rx={7} ry={5} fill={colors.spotLight} />
      <Ellipse cx={112} cy={54} rx={9} ry={6} fill={SPOT_GREY} />
      <Ellipse cx={136} cy={68} rx={5} ry={4} fill={colors.spotLight} />
      <Ellipse cx={56} cy={76} rx={5} ry={3.5} fill={colors.spotLight} opacity={0.9} />
      <Ellipse cx={88} cy={50} rx={4} ry={3} fill={colors.spotLight} opacity={0.9} />
      <Ellipse cx={122} cy={82} rx={6} ry={4} fill={SPOT_GREY} />

      {/* pecho café y collar */}
      <Ellipse cx={161} cy={84} rx={9} ry={7} fill={colors.accent} />
      <Rect x={148} y={44} width={9} height={34} rx={4} fill={colors.success} transform="rotate(-14 152 61)" />

      {/* cabeza y hocico */}
      <Ellipse cx={175} cy={46} rx={23} ry={20} fill={COAT} stroke={OUTLINE} strokeWidth={1.5} />
      <Ellipse cx={196} cy={55} rx={19} ry={10} fill={COAT} stroke={OUTLINE} strokeWidth={1.5} />
      <Ellipse cx={173} cy={47} rx={21} ry={18} fill={COAT} />
      <Ellipse cx={196} cy={62} rx={13} ry={3.5} fill={colors.accent} />
      <Circle cx={213} cy={51} r={5} fill={NOSE} />
      <Ellipse cx={174} cy={33} rx={6} ry={4} fill={SPOT_GREY} />

      {/* oreja larga */}
      <Ellipse cx={160} cy={55} rx={9} ry={19} fill={COAT_FAR} stroke={OUTLINE} strokeWidth={1.5} transform="rotate(10 160 55)" />
      <Ellipse cx={159} cy={62} rx={3.5} ry={5} fill={SPOT_GREY} opacity={0.8} transform="rotate(10 159 62)" />

      {/* ojo y ceja café */}
      <Circle cx={187} cy={42} r={4.5} fill={NOSE} />
      <Circle cx={188.5} cy={40.5} r={1.6} fill="#FFFFFF" />
      <Ellipse cx={185} cy={34} rx={3.5} ry={2} fill={colors.accent} />
    </Svg>
  );
}

/** Manchitas sutiles de pelaje arlequín para decorar tarjetas destacadas (va detrás del contenido). */
export function Spots() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        <Ellipse cx={88} cy={18} rx={9} ry={6} fill={colors.spotGrey} opacity={0.16} />
        <Ellipse cx={74} cy={84} rx={6} ry={4} fill={colors.spotLight} opacity={0.08} />
        <Ellipse cx={96} cy={60} rx={4} ry={3} fill={colors.spotLight} opacity={0.1} />
        <Ellipse cx={6} cy={90} rx={7} ry={5} fill={colors.spotGrey} opacity={0.14} />
        <Ellipse cx={58} cy={6} rx={3} ry={2} fill={colors.spotLight} opacity={0.1} />
      </Svg>
    </View>
  );
}
