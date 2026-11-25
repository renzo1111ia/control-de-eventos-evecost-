import React, { useEffect, useState, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Camera, 
  Keyboard, 
  RefreshCw, 
  ShieldCheck, 
  UserCheck, 
  ArrowRight 
} from 'lucide-react';
import { sounds } from '../utils/audio.js';
import { API_URL } from '../utils/api.js';

export default function ScannerModule({ eventId, onScanSuccess }) {
  const [scanResult, setScanResult] = useState(null);
  const [manualInput, setManualInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [scannerActive, setScannerActive] = useState(true);
  const scannerRef = useRef(null);

  useEffect(() => {
    let html5QrcodeScanner = null;

    if (scannerActive && !scanResult) {
      try {
        html5QrcodeScanner = new Html5QrcodeScanner('qr-reader-container', {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          showTorchButtonIfSupported: true
        });

        html5QrcodeScanner.render(
          async (decodedText) => {
            html5QrcodeScanner.pause(true);
            await processQrData(decodedText);
          },
          (errorMessage) => {
            // Ignorar frames no decodificados normales
          }
        );

        scannerRef.current = html5QrcodeScanner;
      } catch (err) {
        console.warn('Error al inicializar cámara:', err);
      }
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
      }
    };
  }, [scannerActive, scanResult, eventId]);

  const processQrData = async (rawData) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/events/${eventId}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrRawData: rawData })
      });

      const data = await res.json();
      setScanResult(data);

      if (data.status === 'VALID') {
        sounds.playSuccess();
        if (onScanSuccess) onScanSuccess();
      } else if (data.status === 'ALREADY_USED') {
        sounds.playWarning();
      } else {
        sounds.playError();
      }
    } catch (err) {
      setScanResult({
        status: 'ERROR',
        message: 'Error de red al verificar el código QR.'
      });
      sounds.playError();
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    await processQrData(manualInput.trim());
    setManualInput('');
  };

  const resetScanner = () => {
    setScanResult(null);
    setScannerActive(true);
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-black text-white flex items-center justify-center gap-2">
          <Camera className="w-5 h-5 text-emerald-400" />
          Control de Acceso & Escáner QR
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Apunta la cámara a la entrada del asistente para verificar firma y cotejar carnet físico.
        </p>
      </div>

      {/* Visor o Resultado */}
      {!scanResult ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl text-center">
          <div id="qr-reader-container" className="rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 min-h-[280px]" />
          
          <div className="mt-4 pt-4 border-t border-slate-800">
            <span className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Validación Criptográfica HMAC-SHA256 en tiempo real
            </span>
          </div>
        </div>
      ) : (
        /* Pantalla de Resultado de Escaneo (Alta visibilidad nocturna) */
        <div
          className={`p-6 rounded-3xl text-center border-4 shadow-2xl transition-all ${
            scanResult.status === 'VALID'
              ? 'bg-emerald-950/90 border-emerald-500 ring-8 ring-emerald-500/20'
              : scanResult.status === 'ALREADY_USED'
              ? 'bg-amber-950/90 border-amber-500 ring-8 ring-amber-500/20'
              : 'bg-red-950/90 border-red-500 ring-8 ring-red-500/20'
          }`}
        >
          {scanResult.status === 'VALID' && (
            <div className="animate-bounce">
              <CheckCircle2 className="w-20 h-20 text-emerald-400 mx-auto mb-2" />
            </div>
          )}

          {scanResult.status === 'ALREADY_USED' && (
            <AlertTriangle className="w-20 h-20 text-amber-400 mx-auto mb-2" />
          )}

          {['FAKE', 'WRONG_EVENT', 'NOT_FOUND', 'INVALID', 'ERROR'].includes(scanResult.status) && (
            <XCircle className="w-20 h-20 text-red-400 mx-auto mb-2" />
          )}

          <h3 className={`text-2xl font-black uppercase tracking-tight mt-2 ${
            scanResult.status === 'VALID'
              ? 'text-emerald-400'
              : scanResult.status === 'ALREADY_USED'
              ? 'text-amber-400'
              : 'text-red-400'
          }`}>
            {scanResult.message}
          </h3>

          {/* Tarjeta de cotejo de carnet para el guardia */}
          {scanResult.attendee && (
            <div className="mt-5 bg-slate-950/90 p-5 rounded-2xl text-left border border-white/10 shadow-xl space-y-3">
              <div>
                <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">
                  Nombre del Titular:
                </span>
                <span className="text-xl font-black text-white block">
                  {scanResult.attendee.full_name}
                </span>
              </div>

              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                <span className="text-[10px] font-extrabold text-emerald-300 uppercase tracking-wider block">
                  RUT a cotejar con Carnet de Identidad:
                </span>
                <span className="text-2xl font-mono font-black text-emerald-400 tracking-wider">
                  {scanResult.attendee.rut}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800">
                <span>Sector: <strong className="text-white">{scanResult.attendee.tier_name || 'General'}</strong></span>
                {scanResult.checkedInAt && (
                  <span className="text-amber-400 text-[11px]">
                    Ingresó: {new Date(scanResult.checkedInAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
          )}

          {scanResult.details && (
            <p className="text-xs text-slate-300 mt-3 font-medium">
              {scanResult.details}
            </p>
          )}

          <button
            onClick={resetScanner}
            className={`w-full mt-6 py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2 shadow-xl active:scale-[0.99] transition ${
              scanResult.status === 'VALID'
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                : 'bg-white hover:bg-slate-200 text-slate-950'
            }`}
          >
            <span>Escanear Siguiente Entrada</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Ingreso manual por teclado (Respaldo en caso de cámara dañada) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <h4 className="text-xs font-bold text-slate-400 flex items-center gap-1.5 mb-2">
          <Keyboard className="w-4 h-4 text-slate-400" />
          Acreditación Manual por RUT o Código QR (Respaldo)
        </h4>
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            type="text"
            placeholder="Pega el código QR o escribe el RUT chileno (ej: 11.111.111-1)..."
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-3 py-2 rounded-xl text-xs transition"
          >
            Validar
          </button>
        </form>
      </div>
    </div>
  );
}
