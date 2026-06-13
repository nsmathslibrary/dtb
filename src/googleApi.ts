/**
 * Google Drive and Sheets API Integrations helper.
 */

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

export interface RegistrationData {
  regId: string;
  name: string;
  email: string;
  phone: string;
  dob: string;
  category: string;
  stream: string;
  examCenter: string;
  fatherName: string;
  motherName: string;
  address: string;
  maktab: string;
  paymentStatus: string;
  paymentAmount: string;
  transactionId: string;
  fileName: string;
  fileId: string;
  regTime: string;
}

/**
 * Searches for a folder with specific name or creates it if not found
 */
export async function findOrCreateFolder(accessToken: string, folderName: string): Promise<string> {
  const query = encodeURIComponent(`name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const response = await fetch(`${DRIVE_FILES_API}?q=${query}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to query Google Drive folder: ${errText}`);
  }

  const data = await response.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }

  // If folder doesn't exist, create it
  const createResponse = await fetch(DRIVE_FILES_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  if (!createResponse.ok) {
    const errText = await createResponse.text();
    throw new Error(`Failed to create Google Drive folder: ${errText}`);
  }

  const createData = await createResponse.json();
  return createData.id;
}

/**
 * Searches for spreadsheet with name or creates it with default headers
 */
export async function findOrCreateSpreadsheet(accessToken: string, sheetName: string): Promise<string> {
  const query = encodeURIComponent(`name = '${sheetName}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`);
  const response = await fetch(`${DRIVE_FILES_API}?q=${query}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to query spreadsheet file: ${errText}`);
  }

  const data = await response.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }

  // Let's create it
  const createResponse = await fetch(SHEETS_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title: sheetName },
    }),
  });

  if (!createResponse.ok) {
    const errText = await createResponse.text();
    throw new Error(`Failed to create spreadsheet: ${errText}`);
  }

  const createData = await createResponse.json();
  const spreadsheetId = createData.spreadsheetId;

  // Now, initialize headers
  const headers = [
    'Registration ID',
    'Student Name',
    'Father Name',
    'Mother Name',
    'Date of Birth',
    'Mobile Number',
    'Email',
    'Address',
    'Selected Maktab',
    'Exam Center',
    'Student Category',
    'Class Course',
    'Payment Status',
    'Amount Paid',
    'Transaction ID',
    'Photo File Name',
    'Photo Drive ID',
    'Registration Time'
  ];

  await writeSpreadsheetHeaders(accessToken, spreadsheetId, headers);
  return spreadsheetId;
}

async function writeSpreadsheetHeaders(accessToken: string, spreadsheetId: string, headers: string[]): Promise<void> {
  const range = 'Sheet1!A1:R1';
  const response = await fetch(`${SHEETS_API}/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [headers],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to write headers: ${errText}`);
  }
}

/**
 * Uploads file blob to Google Drive in steps (metadata + file payload)
 */
export async function uploadPhotoToDrive(
  accessToken: string,
  folderId: string,
  fileName: string,
  fileBlob: Blob
): Promise<string> {
  // Step 1: Create file metadata
  const metadataResponse = await fetch(DRIVE_FILES_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: fileName,
      parents: [folderId],
    }),
  });

  if (!metadataResponse.ok) {
    const errText = await metadataResponse.text();
    throw new Error(`Failed to create file metadata in Drive: ${errText}`);
  }

  const metadata = await metadataResponse.json();
  const fileId = metadata.id;

  // Step 2: Upload file content (media type)
  const uploadResponse = await fetch(`${DRIVE_UPLOAD_API}/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': fileBlob.type || 'image/jpeg',
    },
    body: fileBlob,
  });

  if (!uploadResponse.ok) {
    const errText = await uploadResponse.text();
    throw new Error(`Failed to upload media content to Drive: ${errText}`);
  }

  return fileId;
}

/**
 * Appends registration row to sheet
 */
export async function appendRegistration(
  accessToken: string,
  spreadsheetId: string,
  data: RegistrationData
): Promise<void> {
  const range = 'Sheet1!A:R';
  const row = [
    data.regId,
    data.name,
    data.fatherName,
    data.motherName,
    data.dob,
    data.phone,
    data.email,
    data.address,
    data.maktab,
    data.examCenter,
    data.category,
    data.stream,
    data.paymentStatus,
    data.paymentAmount,
    data.transactionId,
    data.fileName,
    data.fileId,
    data.regTime,
  ];

  const response = await fetch(`${SHEETS_API}/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [row],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to append registration info to spreadsheet: ${errText}`);
  }
}

/**
 * Fetches all registrations to find existing entries or verify registration
 */
export async function fetchRegistrations(accessToken: string, spreadsheetId: string): Promise<RegistrationData[]> {
  const range = 'Sheet1!A2:R1000'; // fetch up to 1000 records
  const response = await fetch(`${SHEETS_API}/${spreadsheetId}/values/${range}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to fetch spreadsheet rows: ${errText}`);
  }

  const data = await response.json();
  if (!data.values) {
    return [];
  }

  return data.values.map((row: any[]) => ({
    regId: row[0] || '',
    name: row[1] || '',
    fatherName: row[2] || '',
    motherName: row[3] || '',
    dob: row[4] || '',
    phone: row[5] || '',
    email: row[6] || '',
    address: row[7] || '',
    maktab: row[8] || '',
    examCenter: row[9] || '',
    category: row[10] || '',
    stream: row[11] || '',
    paymentStatus: row[12] || '',
    paymentAmount: row[13] || '',
    transactionId: row[14] || '',
    fileName: row[15] || '',
    fileId: row[16] || '',
    regTime: row[17] || '',
  }));
}

/**
 * Downloads full binary blob of a file from drive and returns an local Object URL
 */
export async function fetchDriveFileBlobUrl(accessToken: string, fileId: string): Promise<string> {
  const response = await fetch(`${DRIVE_FILES_API}/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error('Failed to retrieve file from Google Drive');
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
