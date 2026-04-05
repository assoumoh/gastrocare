import React from 'react';
import { X, Download, Printer } from 'lucide-react';

interface DocumentViewerProps {
  document: any;
  onClose: () => void;
}

export default function DocumentViewer({ document, onClose }: DocumentViewerProps) {
  if (!document || !document.url_fichier) return null;

  const isImage = document.url_fichier.match(/\.(jpeg|jpg|gif|png)$/i) || document.url_fichier.includes('alt=media');
  // Note: Firebase storage URLs usually don't have the extension at the end, but they have alt=media.
  // A better way is to check the file type if we stored it, but we didn't.
  // Let's assume it's an image if it's not explicitly a PDF, or we can just use an iframe for PDFs and img for images.
  // Actually, iframe works for both in most modern browsers.

  const handlePrint = () => {
    const printWindow = window.open(document.url_fichier, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50 rounded-t-xl">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold text-slate-900">
              {document.titre}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 capitalize">
              {document.type_document}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center px-3 py-2 border border-slate-300 shadow-sm text-sm leading-4 font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Printer className="mr-2 h-4 w-4" />
              Imprimer
            </button>
            <a
              href={document.url_fichier}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="inline-flex items-center px-3 py-2 border border-slate-300 shadow-sm text-sm leading-4 font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Download className="mr-2 h-4 w-4" />
              Télécharger
            </a>
            <button
              onClick={onClose}
              className="ml-2 p-2 rounded-md text-slate-400 hover:text-slate-500 hover:bg-slate-100 focus:outline-none"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        <div className="flex-1 p-4 bg-slate-100 overflow-auto flex justify-center items-center">
          {/* Using iframe for PDF and object/img for others. Iframe is generally good for PDFs */}
          <iframe
            src={document.url_fichier}
            className="w-full h-full rounded shadow-sm bg-white"
            title={document.titre}
          />
        </div>
      </div>
    </div>
  );
}
