// client/src/pages/admin/professionals.jsx
import React from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import ProfessionalVerification from '../../components/admin/ProfessionalVerification';
import { Container } from 'react-bootstrap';

const ProfessionalsPage = () => {
  return (
    <AdminLayout>
      <Container fluid className="py-4">
        <h2 className="mb-4">Professional Verification</h2>
        <ProfessionalVerification />
      </Container>
    </AdminLayout>
  );
};

export default ProfessionalsPage;