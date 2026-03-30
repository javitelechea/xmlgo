/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, ChangeEvent } from 'react';
import { Upload, Download, FileCode, AlertCircle, CheckCircle2, FileJson, Trash2, Code } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Instance {
  id: number;
  start: number;
  end: number;
  code: string;
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [xmlContent, setXmlContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. parseSportscodeTimeline(rawText)
  const parseSportscodeTimeline = (rawText: string): any => {
    try {
      return JSON.parse(rawText);
    } catch (e) {
      throw new Error("El archivo no es un JSON válido (.SCTimeline).");
    }
  };

  // 2. extractInstances(data)
  const extractInstances = (data: any): Instance[] => {
    const instances: Instance[] = [];
    let counter = 1;

    // Helper to find instances in various structures
    const findInObject = (obj: any, currentCode: string = "Unknown") => {
      if (!obj || typeof obj !== 'object') return;

      // Check if this object itself looks like an instance
      const start = obj.start ?? obj.startTime ?? obj.start_time;
      const end = obj.end ?? obj.endTime ?? obj.end_time;
      const code = obj.code ?? obj.name ?? obj.label ?? obj.rowName ?? currentCode;

      if (typeof start === 'number' && typeof end === 'number') {
        instances.push({
          id: 0, // Will be re-assigned after sorting
          start: start,
          end: end,
          code: String(code)
        });
        return;
      }

      // Recursive search in common keys
      const keysToSearch = ['rows', 'tracks', 'codes', 'instances', 'events', 'labels', 'data', 'children'];
      
      for (const key of keysToSearch) {
        if (Array.isArray(obj[key])) {
          const rowName = obj.name || obj.code || currentCode;
          obj[key].forEach((item: any) => findInObject(item, rowName));
        } else if (obj[key] && typeof obj[key] === 'object') {
          findInObject(obj[key], currentCode);
        }
      }

      // If it's an array but not under a specific key, search elements
      if (Array.isArray(obj)) {
        obj.forEach((item: any) => findInObject(item, currentCode));
      }
    };

    findInObject(data);

    if (instances.length === 0) {
      throw new Error("No se encontraron instancias o eventos en el archivo.");
    }

    // Sort by start time
    instances.sort((a, b) => a.start - b.start);

    // Assign sequential IDs
    return instances.map((inst, index) => ({
      ...inst,
      id: index + 1
    }));
  };

  // 3. buildXml(instances)
  const buildXml = (instances: Instance[]): string => {
    const header = '<?xml version="1.0" encoding="utf-8"?>\n';
    let xml = '<file>\n';
    xml += '  <ALL_INSTANCES>\n';

    instances.forEach((inst) => {
      xml += '    <instance>\n';
      xml += `      <ID>${inst.id}</ID>\n`;
      xml += `      <start>${inst.start}</start>\n`;
      xml += `      <end>${inst.end}</end>\n`;
      xml += `      <code>${escapeXml(inst.code)}</code>\n`;
      xml += '    </instance>\n';
    });

    xml += '  </ALL_INSTANCES>\n';
    xml += '</file>';

    return header + xml;
  };

  // 4. escapeXml(value)
  const escapeXml = (value: string): string => {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setXmlContent(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      setFile(droppedFile);
      setError(null);
      setXmlContent(null);
    }
  };

  const processFile = async () => {
    if (!file) return;

    try {
      const text = await file.text();
      const data = parseSportscodeTimeline(text);
      const instances = extractInstances(data);
      const xml = buildXml(instances);
      setXmlContent(xml);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Error al procesar el archivo.");
      setXmlContent(null);
    }
  };

  const downloadXml = () => {
    if (!xmlContent || !file) return;

    const blob = new Blob([xmlContent], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const fileName = file.name.replace(/\.[^/.]+$/, "") + ".xml";
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setFile(null);
    setXmlContent(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#212529] font-sans p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12 text-center">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center justify-center p-3 mb-4 bg-white rounded-2xl shadow-sm border border-gray-100"
          >
            <FileCode className="w-8 h-8 text-blue-600" />
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-3xl font-bold tracking-tight text-gray-900 mb-2"
          >
            SCTimeline to XML
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-gray-500 max-w-md mx-auto"
          >
            Convierte archivos de Sportscode a un formato XML específico para análisis de datos.
          </motion.p>
        </header>

        <main className="space-y-6">
          {/* Upload Section */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`relative border-2 border-dashed rounded-3xl p-12 transition-all duration-200 text-center ${
              isDragging ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".SCTimeline,.json"
              className="hidden"
            />

            {!file ? (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <div className="p-4 bg-gray-50 rounded-full">
                    <Upload className="w-10 h-10 text-gray-400" />
                  </div>
                </div>
                <div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-blue-600 font-semibold hover:text-blue-700 transition-colors"
                  >
                    Selecciona un archivo
                  </button>
                  <span className="text-gray-500"> o arrástralo aquí</span>
                </div>
                <p className="text-xs text-gray-400">Soporta archivos .SCTimeline (JSON)</p>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-4">
                <div className="flex items-center p-4 bg-blue-50 rounded-2xl border border-blue-100 w-full max-w-sm">
                  <FileJson className="w-8 h-8 text-blue-600 mr-3 flex-shrink-0" />
                  <div className="text-left overflow-hidden">
                    <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                    <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button 
                    onClick={reset}
                    className="ml-auto p-2 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                
                {!xmlContent && (
                  <button
                    onClick={processFile}
                    className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95"
                  >
                    Convertir a XML
                  </button>
                )}
              </div>
            )}
          </motion.div>

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-red-50 border border-red-100 text-red-700 p-4 rounded-2xl flex items-start space-x-3"
              >
                <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Result Section */}
          <AnimatePresence>
            {xmlContent && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center space-x-2 text-green-600">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-sm font-semibold">Conversión exitosa</span>
                  </div>
                  <button
                    onClick={downloadXml}
                    className="flex items-center space-x-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-all active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                    <span>Descargar .xml</span>
                  </button>
                </div>

                <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
                  <div className="flex items-center justify-between px-6 py-4 border-bottom border-gray-100 bg-gray-50/50">
                    <div className="flex items-center space-x-2">
                      <Code className="w-4 h-4 text-gray-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Vista previa XML</span>
                    </div>
                  </div>
                  <div className="p-6 overflow-x-auto">
                    <pre className="text-xs font-mono text-gray-700 leading-relaxed">
                      {xmlContent}
                    </pre>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <footer className="mt-16 text-center text-gray-400 text-xs">
          <p>© 2026 SCTimeline Converter • Herramienta local y segura</p>
        </footer>
      </div>
    </div>
  );
}
