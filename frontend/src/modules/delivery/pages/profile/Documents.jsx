import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileCheck, UploadCloud, XCircle, Clock } from "lucide-react";
import Button from "@/shared/components/ui/Button";
import Card from "@/shared/components/ui/Card";
import { toast } from "sonner";
import { useAuth } from "@core/context/AuthContext";
import { formatDate } from "@shared/utils/formatDate";

const Documents = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [activeDocId, setActiveDocId] = useState(null);

  const [docs, setDocs] = useState([]);

  useEffect(() => {
    if (user) {
      setDocs([
        {
          id: "aadhar",
          title: "Aadhar Card",
          status: user?.documents?.aadhar ? (user?.isVerified ? "Verified" : "Pending") : (user?.aadharNumber ? "Verified" : "Pending"),
          uploadedOn: user?.createdAt ? formatDate(user.createdAt, "—") : "—",
          fileName: user?.documents?.aadhar ? (user.documents.aadhar.split("/").pop() || "Aadhar Card") : (user?.aadharNumber ? `Aadhar (XXXX-${user.aadharNumber.slice(-4)})` : null),
          url: user?.documents?.aadhar || null,
        },
        {
          id: "pan",
          title: "PAN Card",
          status: user?.documents?.pan ? (user?.isVerified ? "Verified" : "Pending") : (user?.panNumber ? "Verified" : "Pending"),
          uploadedOn: user?.createdAt ? formatDate(user.createdAt, "—") : "—",
          fileName: user?.documents?.pan ? (user.documents.pan.split("/").pop() || "PAN Card") : (user?.panNumber ? `PAN (${user.panNumber})` : null),
          url: user?.documents?.pan || null,
        },
        {
          id: "dl",
          title: "Driving License",
          status: user?.documents?.drivingLicense ? (user?.isVerified ? "Verified" : "Pending") : (user?.drivingLicenseNumber ? "Verified" : "Pending"),
          uploadedOn: user?.createdAt ? formatDate(user.createdAt, "—") : "—",
          fileName: user?.documents?.drivingLicense ? (user.documents.drivingLicense.split("/").pop() || "Driving License") : (user?.drivingLicenseNumber ? `DL (${user.drivingLicenseNumber})` : null),
          url: user?.documents?.drivingLicense || null,
        },
      ]);
    }
  }, [user]);

  const handleUpload = (id) => {
    setActiveDocId(id);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && activeDocId) {
      setDocs(docs.map(doc =>
        doc.id === activeDocId
          ? { ...doc, status: "Pending", fileName: file.name, uploadedOn: new Date().toLocaleDateString('en-GB') }
          : doc
      ));
      toast.success(`${file.name} uploaded successfully! Status changed to Pending.`);
      setActiveDocId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "Verified":
        return (
          <span className="flex items-center text-brand-600 bg-brand-50 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
            <FileCheck size={12} className="mr-1" /> Verified
          </span>
        );
      case "Pending":
        return (
          <span className="flex items-center text-yellow-600 bg-yellow-50 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
            <Clock size={12} className="mr-1" /> Pending
          </span>
        );
      case "Rejected":
        return (
          <span className="flex items-center text-red-600 bg-red-50 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
            <XCircle size={12} className="mr-1" /> Rejected
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="flex items-center p-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors mr-2"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <h1 className="ds-h3 text-gray-900">My Documents</h1>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-4">
        {docs.map((doc) => (
          <Card key={doc.id} className="p-4 border border-gray-100">
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-bold text-gray-800">{doc.title}</h4>
              {getStatusBadge(doc.status)}
            </div>

            {doc.fileName && (
              <p className="text-xs text-gray-500 mb-3 flex items-center">
                <span className="truncate max-w-[200px]">{doc.fileName}</span>
                <span className="mx-2">•</span>
                <span>{doc.uploadedOn}</span>
              </p>
            )}

            {doc.status === "Rejected" && (
              <div className="bg-red-50 text-red-700 text-xs p-2 rounded mb-3">
                Reason: {doc.reason}
              </div>
            )}

            <div className="flex space-x-2">
              {doc.status !== "Verified" && (
                <Button
                  size="sm"
                  className="w-full text-xs h-8"
                  onClick={() => handleUpload(doc.id)}
                >
                  <UploadCloud size={14} className="mr-1" />
                  {doc.status === "Rejected" ? "Re-upload" : "Update"}
                </Button>
              )}
              {doc.url ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs h-8"
                  onClick={() => window.open(doc.url, "_blank")}
                >
                  View File
                </Button>
              ) : doc.fileName ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs h-8"
                  onClick={() => toast.info(`${doc.title} is verified and recorded.`)}
                >
                  View Details
                </Button>
              ) : null}
            </div>
          </Card>
        ))}
      </div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*,.pdf"
      />
    </div>
  );
};

export default Documents;
