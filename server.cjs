const express = require("express");
const cors = require("cors");
const db = require("./db");
const path = require("path");
const multer = require("multer");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// optional tapi biasanya ada
app.use(cors());

// ================== UPLOAD FOTO ==================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "foto"));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = Date.now() + ext;
    cb(null, filename);
  },
});

const normalizeProgram = (str) => {
  return str
    ?.toLowerCase()
    .replace(/[\s\/]/g, "")
    .trim();
};

const upload = multer({ storage });

app.use(cors());
app.use(express.json());

// ================== TEST ==================
app.get("/", (req, res) => {
  res.send("API SQLite berjalan 🚀");
});

// ================== REGISTER ==================
app.post("/register", (req, res) => {
  const { nama_club, nama_pelatih, password } = req.body;

  try {
    const existing = db
      .prepare("SELECT * FROM pelatih WHERE nama_pelatih = ?")
      .get(nama_pelatih);

    if (existing) {
      return res.json({
        success: false,
        message: "Nama pelatih sudah terdaftar",
      });
    }

    const result = db
      .prepare(
        "INSERT INTO pelatih (nama_club, nama_pelatih, password) VALUES (?, ?, ?)",
      )
      .run(nama_club, nama_pelatih, password);

    // Ambil data user yang baru saja dibuat
    const newUser = db
      .prepare("SELECT * FROM pelatih WHERE id = ?")
      .get(result.lastInsertRowid);

    // Kirim response lengkap termasuk data user
    res.json({ success: true, user: newUser });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// ================== LOGIN ==================
app.post("/login", (req, res) => {
  const { nama_pelatih, password } = req.body;
  console.log("Login attempt:", nama_pelatih, password); // 🔥

  try {
    const user = db
      .prepare("SELECT * FROM pelatih WHERE nama_pelatih = ? AND password = ?")
      .get(nama_pelatih, password);

    console.log("User found:", user); // 🔥

    if (user) {
      res.json({ success: true, user });
    } else {
      res.json({ success: false });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// ================== TAMBAH ATLET ==================
app.post("/atlet", upload.single("foto"), (req, res) => {
  try {
    const {
      id_pelatih,
      nisnas,
      nama_atlet,
      jenis_kelamin,
      tanggal_lahir,
      nik,
      nomor_hp,
      alamat,
      kategori,
    } = req.body;

    console.log("BODY:", req.body);
    console.log("FILE:", req.file);

    if (!id_pelatih || isNaN(Number(id_pelatih))) {
      return res.status(400).json({
        success: false,
        error: "id_pelatih tidak valid",
      });
    }

    if (!nama_atlet) {
      return res.status(400).json({
        success: false,
        error: "nama_atlet wajib diisi",
      });
    }

    const fotoFile = req.file ? req.file.filename : null;

    const result = db
      .prepare(
        `
      INSERT INTO atlet 
      (id_pelatih, nisnas, nama_atlet, jenis_kelamin, tanggal_lahir, nomor_hp, alamat, kategori, status, created_at, nik, foto)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `,
      )
      .run(
        Number(id_pelatih),
        nisnas || null,
        nama_atlet,
        jenis_kelamin || null,
        tanggal_lahir || null,
        nomor_hp || null,
        alamat || null,
        kategori || null,
        "aktif",
        new Date().toISOString(),
        nik || null,
        fotoFile,
      );

    res.json({
      success: true,
      id_atlet: result.lastInsertRowid,
      nama_atlet,
      kategori,
      status: "aktif",
      foto: fotoFile,
    });
  } catch (err) {
    console.error("Error simpan atlet:", err);
    res.status(500).json({ success: false, error: "Gagal simpan data" });
  }
});

// ================== GET ATLET ==================
app.get("/atlet", (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM atlet ORDER BY id_atlet DESC").all();

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal ambil data atlet" });
  }
});

// ================== GET DETAIL ATLET ==================
app.get("/atlet/:id", (req, res) => {
  console.log("MASUK ROUTE ATLET");
  try {
    const { id } = req.params;

    const atlet = db.prepare("SELECT * FROM atlet WHERE id_atlet = ?").get(id);

    if (!atlet) {
      return res.status(404).json({
        success: false,
        error: "Data atlet tidak ditemukan",
      });
    }

    res.json({
      success: true,
      data: atlet,
    });
  } catch (err) {
    console.error("Error ambil detail atlet:", err);
    res.status(500).json({
      success: false,
      error: "Gagal ambil detail atlet",
    });
  }
});

// ================== UPDATE ATLET ==================
app.put("/atlet/:id", upload.single("foto"), (req, res) => {
  const { id } = req.params;
  const {
    nama_atlet,
    nisnas,
    jenis_kelamin,
    tanggal_lahir,
    nik,
    nomor_hp,
    alamat,
    kategori,
  } = req.body;

  try {
    let fotoFile = null;
    if (req.file) {
      fotoFile = req.file.filename;
    }

    // Update SQLite
    const stmt = db.prepare(`
      UPDATE atlet SET
        nama_atlet = ?,
        nisnas = ?,
        jenis_kelamin = ?,
        tanggal_lahir = ?,
        nik = ?,
        nomor_hp = ?,
        alamat = ?,
        kategori = ? ${fotoFile ? ", foto = ?" : ""}
      WHERE id_atlet = ?
    `);

    if (fotoFile) {
      stmt.run(
        nama_atlet,
        nisnas,
        jenis_kelamin,
        tanggal_lahir,
        nik,
        nomor_hp,
        alamat,
        kategori,
        fotoFile,
        id,
      );
    } else {
      stmt.run(
        nama_atlet,
        nisnas,
        jenis_kelamin,
        tanggal_lahir,
        nik,
        nomor_hp,
        alamat,
        kategori,
        id,
      );
    }

    // Ambil data atlet yang baru diupdate
    const updatedAtlet = db
      .prepare("SELECT * FROM atlet WHERE id_atlet = ?")
      .get(id);

    res.json({ success: true, atlet: updatedAtlet });
  } catch (err) {
    console.error("Error update atlet:", err);
    res.status(500).json({ success: false, error: "Gagal update data" });
  }
});

// ================== DELETE ATLET ==================
app.delete("/atlet/:id", (req, res) => {
  const { id } = req.params;

  try {
    // Hapus atlet dari database
    const stmt = db.prepare("DELETE FROM atlet WHERE id_atlet = ?");
    const result = stmt.run(id);

    if (result.changes === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Data atlet tidak ditemukan" });
    }

    res.json({ success: true, message: "Data atlet berhasil dihapus" });
  } catch (err) {
    console.error("Error hapus atlet:", err);
    res.status(500).json({ success: false, error: "Gagal hapus data" });
  }
});

// ================== TAMBAH KELAS DENGAN ATLET ==================
app.post("/kelas", (req, res) => {
  try {
    const { nama_kelas, deskripsi, atletIds } = req.body; // atletIds = [1,2,3]

    if (!nama_kelas || !atletIds || atletIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Isi nama kelas dan pilih minimal 1 atlet",
      });
    }

    // 1️⃣ Simpan kelas dulu
    const kelasResult = db
      .prepare("INSERT INTO kelas (nama_kelas, deskripsi) VALUES (?, ?)")
      .run(nama_kelas, deskripsi || null);

    const id_kelas = kelasResult.lastInsertRowid;

    // 2️⃣ Update kolom id_kelas pada atlet
    const updateAtlet = db.prepare(
      "UPDATE atlet SET id_kelas = ? WHERE id_atlet = ?",
    );
    const updateMany = db.transaction((ids) => {
      ids.forEach((id_atlet) => updateAtlet.run(id_kelas, id_atlet));
    });
    updateMany(atletIds);

    res.json({ success: true, id_kelas, nama_kelas });
  } catch (err) {
    console.error("Error simpan kelas:", err);
    res.status(500).json({ success: false, message: "Gagal simpan kelas" });
  }
});

// ================== GET KELAS BESERTA ATLET ==================
app.get("/kelas", (req, res) => {
  try {
    const sql = `
      SELECT 
          k.id_kelas,
          k.nama_kelas,
          k.deskripsi,
          a.id_atlet,
          a.nama_atlet,
          a.foto
      FROM kelas k
      LEFT JOIN atlet a ON k.id_kelas = a.id_kelas
      ORDER BY k.id_kelas;
    `;

    const rows = db.prepare(sql).all();

    // format data per kelas supaya atletnya jadi array
    const kelasMap = {};
    rows.forEach((row) => {
      if (!kelasMap[row.id_kelas]) {
        kelasMap[row.id_kelas] = {
          id_kelas: row.id_kelas,
          nama_kelas: row.nama_kelas,
          deskripsi: row.deskripsi,
          atlet: [],
        };
      }
      if (row.id_atlet) {
        kelasMap[row.id_kelas].atlet.push({
          id_atlet: row.id_atlet,
          nama_atlet: row.nama_atlet,
          foto: row.foto,
        });
      }
    });

    res.json(Object.values(kelasMap));
  } catch (err) {
    console.error("Error ambil data kelas:", err);
    res.status(500).json({ success: false, message: "Gagal ambil data kelas" });
  }
});

// ================== UPDATE KELAS ==================
app.put("/kelas/:id", (req, res) => {
  const { id } = req.params;
  const { nama_kelas, deskripsi, atletIds } = req.body;

  try {
    // 1️⃣ Update nama & deskripsi kelas
    db.prepare(
      "UPDATE kelas SET nama_kelas = ?, deskripsi = ? WHERE id_kelas = ?",
    ).run(nama_kelas, deskripsi || null, id);

    // 2️⃣ Hapus semua atlet dari kelas ini dulu
    db.prepare("UPDATE atlet SET id_kelas = NULL WHERE id_kelas = ?").run(id);

    // 3️⃣ Assign atlet baru
    const updateAtlet = db.prepare(
      "UPDATE atlet SET id_kelas = ? WHERE id_atlet = ?",
    );
    const updateMany = db.transaction((ids) => {
      ids.forEach((id_atlet) => updateAtlet.run(id, id_atlet));
    });
    if (atletIds && atletIds.length > 0) updateMany(atletIds);

    // 4️⃣ Ambil data kelas beserta atlet terbaru
    const kelasRows = db
      .prepare(
        `
      SELECT 
          k.id_kelas,
          k.nama_kelas,
          k.deskripsi,
          a.id_atlet,
          a.nama_atlet,
          a.foto
      FROM kelas k
      LEFT JOIN atlet a ON k.id_kelas = a.id_kelas
      WHERE k.id_kelas = ?
    `,
      )
      .all(id);

    const kelasMap = {};
    kelasRows.forEach((row) => {
      if (!kelasMap[row.id_kelas]) {
        kelasMap[row.id_kelas] = {
          id_kelas: row.id_kelas,
          nama_kelas: row.nama_kelas,
          deskripsi: row.deskripsi,
          atlet: [],
        };
      }
      if (row.id_atlet) {
        kelasMap[row.id_kelas].atlet.push({
          id_atlet: row.id_atlet,
          nama_atlet: row.nama_atlet,
          foto: row.foto,
        });
      }
    });

    res.json({ success: true, kelas: Object.values(kelasMap)[0] });
  } catch (err) {
    console.error("Error update kelas:", err);
    res.status(500).json({ success: false, message: "Gagal update kelas" });
  }
});

// DELETE /kelas/:id
app.delete("/kelas/:id", (req, res) => {
  const { id } = req.params;
  try {
    // 1️⃣ Set id_kelas di atlet menjadi NULL
    db.prepare("UPDATE atlet SET id_kelas = NULL WHERE id_kelas = ?").run(id);

    // 2️⃣ Hapus kelas
    const result = db.prepare("DELETE FROM kelas WHERE id_kelas = ?").run(id);

    if (result.changes === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Kelas tidak ditemukan" });
    }

    res.json({
      success: true,
      message: "Kelas berhasil dihapus dan atlet di-reset",
    });
  } catch (err) {
    console.error("Gagal hapus kelas:", err);
    res.status(500).json({ success: false, message: "Gagal hapus kelas" });
  }
});

// ================== GET DETAIL KELAS ==================
app.get("/kelas/:id", (req, res) => {
  try {
    const { id } = req.params;

    const rows = db
      .prepare(
        `
      SELECT 
          k.id_kelas,
          k.nama_kelas,
          k.deskripsi,
          a.id_atlet,
          a.nama_atlet,
          a.foto
      FROM kelas k
      LEFT JOIN atlet a ON k.id_kelas = a.id_kelas
      WHERE k.id_kelas = ?
    `,
      )
      .all(id);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Kelas tidak ditemukan",
      });
    }

    // format data per kelas supaya atletnya jadi array
    const kelasMap = {
      id_kelas: rows[0].id_kelas,
      nama_kelas: rows[0].nama_kelas,
      deskripsi: rows[0].deskripsi,
      atlet: [],
    };

    rows.forEach((row) => {
      if (row.id_atlet) {
        kelasMap.atlet.push({
          id_atlet: row.id_atlet,
          nama_atlet: row.nama_atlet,
          foto: row.foto,
        });
      }
    });

    res.json(kelasMap);
  } catch (err) {
    console.error("Error ambil detail kelas:", err);
    res
      .status(500)
      .json({ success: false, message: "Gagal ambil detail kelas" });
  }
});

app.post("/jadwal", (req, res) => {
  const { id_pelatih, id_kelas, title, start, end, lokasi, kategori } =
    req.body;

  try {
    const result = db
      .prepare(
        `
      INSERT INTO jadwal (id_pelatih, id_kelas, title, start, end, lokasi, kategori)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(id_pelatih, id_kelas, title, start, end, lokasi, kategori || "swim");

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

app.get("/jadwal", (req, res) => {
  const { kategori } = req.query;

  try {
    let query = `
      SELECT j.*, k.nama_kelas
      FROM jadwal j
      JOIN kelas k ON j.id_kelas = k.id_kelas
    `;

    let params = [];

    if (kategori) {
      query += " WHERE j.kategori = ?";
      params.push(kategori);
    }

    const rows = db.prepare(query).all(...params);

    const events = rows.map((row) => ({
      id: row.id_jadwal,
      title: row.title,
      start: row.start,
      end: row.end,
      extendedProps: {
        id_kelas: row.id_kelas,
        kelas: row.nama_kelas,
        lokasi: row.lokasi,
        kategori: row.kategori,
      },
    }));

    res.json(events);
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.put("/jadwal/:id", (req, res) => {
  const { id } = req.params;
  const { id_kelas, title, start, end, lokasi } = req.body;

  try {
    db.prepare(
      `
      UPDATE jadwal
      SET id_kelas=?, title=?, start=?, end=?, lokasi=?
      WHERE id_jadwal=?
    `,
    ).run(id_kelas, title, start, end, lokasi, id);

    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false });
  }
});

app.delete("/jadwal/:id", (req, res) => {
  const { id } = req.params;

  db.prepare("DELETE FROM jadwal WHERE id_jadwal=?").run(id);
  res.json({ success: true });
});

// ================== GET ATLET SESUAI KELAS & JADWAL ==================
app.get("/kelas/:id_kelas/jadwal/:id_jadwal/atlet", (req, res) => {
  try {
    const { id_kelas, id_jadwal } = req.params;
    const { program } = req.query;

    const programFix = program || "swim";

    const sql = `
SELECT 
  a.id_atlet, 
  a.nama_atlet, 
  a.foto,
  a.id_kelas,
  p.id_penilaian,
  p.nilai
FROM atlet a
JOIN jadwal j 
  ON j.id_kelas = a.id_kelas
LEFT JOIN penilaian p 
  ON p.id_atlet = a.id_atlet
  AND p.id_jadwal = j.id_jadwal
  AND p.program = ?
WHERE a.id_kelas = ?
AND j.id_jadwal = ?
`;

    const atlet = db.prepare(sql).all(programFix, id_kelas, id_jadwal);

    res.json({
      success: true,
      atlet,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Gagal ambil atlet",
    });
  }
});

// ================== PENILAIAN SWIM ==================

app.post("/penilaian", (req, res) => {
  const { id_atlet, id_kelas, id_jadwal, program, nilai, rata_rata } = req.body;

  try {
    // Trim program agar konsisten
    const prog = program.trim();

    // Gunakan INSERT OR REPLACE
    const stmt = db.prepare(`
      INSERT INTO penilaian
        (id_penilaian, id_atlet, id_kelas, id_jadwal, program, nilai, rata_rata)
      VALUES (
        COALESCE(
          (SELECT id_penilaian 
           FROM penilaian 
           WHERE id_atlet = ? AND id_kelas = ? AND id_jadwal = ? AND program = ?),
          NULL
        ),
        ?, ?, ?, ?, ?, ?
      )
      ON CONFLICT(id_penilaian) DO UPDATE SET
        nilai = excluded.nilai,
        rata_rata = excluded.rata_rata
    `);

    stmt.run(
      id_atlet,
      id_kelas,
      id_jadwal,
      prog, // untuk COALESCE subquery
      id_atlet,
      id_kelas,
      id_jadwal,
      prog, // untuk INSERT
      JSON.stringify(nilai),
      rata_rata,
    );

    return res.json({
      success: true,
      message: "Data berhasil disimpan/diupdate",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/prestasi", (req, res) => {
  try {
    console.log("MASUK PRESTASI");
    const {
      id_atlet,
      id_kelas,
      id_pelatih,
      id_jadwal,
      nama_lomba,
      personal_best,
      tahun,
      program,
      id_penilaian,
    } = req.body;

    // VALIDASI
    if (!id_atlet || !nama_lomba || !program) {
      return res.json({
        success: false,
        message: "Data wajib tidak lengkap",
      });
    }

    // 🔍 CEK DATA SUDAH ADA (biar tidak dobel)
    const existing = db
      .prepare(
        `
      SELECT id_prestasi 
      FROM prestasi 
      WHERE id_atlet = ?
      AND nama_lomba = ?
      AND program = ?
    `,
      )
      .get(id_atlet, nama_lomba, program);

    if (existing) {
      // 🔄 UPDATE kalau sudah ada
      db.prepare(
        `
        UPDATE prestasi SET
          personal_best = ?,
          program = ?,
          tahun = ?,
          id_kelas = ?,
          id_pelatih = ?,
          id_jadwal = ?,
          id_penilaian = ?
        WHERE id_prestasi = ?
      `,
      ).run(
        personal_best,
        program,
        tahun,
        id_kelas,
        id_pelatih,
        id_jadwal,
        id_penilaian || null,
        existing.id_prestasi,
      );

      return res.json({
        success: true,
        message: "Prestasi berhasil diupdate",
      });
    }

    // ✅ INSERT BARU
    db.prepare(
      `
      INSERT INTO prestasi (
        id_atlet,
        id_kelas,
        id_pelatih,
        id_jadwal,
        nama_lomba,
        personal_best,
        tahun,
        program,
        id_penilaian
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      id_atlet,
      id_kelas,
      id_pelatih,
      id_jadwal,
      nama_lomba,
      personal_best,
      tahun,
      program,
      id_penilaian || null,
    );

    res.json({
      success: true,
      message: "Prestasi berhasil ditambahkan",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan server",
    });
  }
});

app.get("/prestasi/:id_atlet", (req, res) => {
  try {
    const { id_atlet } = req.params;

    const data = db
      .prepare(
        `
      SELECT 
        p.*,
        k.nama_kelas,
        pl.nama_pelatih
      FROM prestasi p
      LEFT JOIN kelas k ON p.id_kelas = k.id_kelas
      LEFT JOIN pelatih pl ON p.id_pelatih = pl.id
      WHERE p.id_atlet = ?
      ORDER BY p.created_at DESC
    `,
      )
      .all(id_atlet);

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Gagal ambil data",
    });
  }
});

app.get("/prestasi/:id_atlet/:id_kelas/:program", (req, res) => {
  const { id_atlet, id_kelas, program } = req.params;

  let data = db
    .prepare(
      `
      SELECT personal_best 
      FROM prestasi
      WHERE id_atlet = ? AND id_kelas = ? AND program = ?
    `,
    )
    .all(id_atlet, id_kelas, program);

  // fallback kalau tidak ada
  if (data.length === 0) {
    data = db
      .prepare(
        `
        SELECT personal_best 
        FROM prestasi
        WHERE id_atlet = ? AND program = ?
      `,
      )
      .all(id_atlet, program);
  }

  res.json(data);
});

app.get(
  "/penilaian/avg/:id_atlet/:id_kelas/:id_jadwal/:program",
  (req, res) => {
    const { id_atlet, id_kelas, id_jadwal, program } = req.params;

    try {
      const data = db
        .prepare(
          `
        SELECT rata_rata
        FROM penilaian
        WHERE id_atlet = ?
        AND id_kelas = ?
        AND id_jadwal = ?
        AND program = ?
      `,
        )
        .get(id_atlet, id_kelas, id_jadwal, program);

      if (!data) {
        return res.json({ rata_rata: 0 }); // 🔥 penting biar tidak null
      }

      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ rata_rata: 0 });
    }
  },
);

// ================== PENILAIAN DRYLAND ==================

app.post("/penilaian_dryland", (req, res) => {
  const { id_atlet, id_kelas, id_jadwal, program, nilai, catatan } = req.body;

  try {
    // 🔥 WAJIB pakai prepare().run()
    const stmt = db.prepare(`
      INSERT INTO penilaian_dryland 
      (id_atlet, id_kelas, id_jadwal, program, nilai, catatan, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)

      ON CONFLICT(id_atlet, id_kelas, id_jadwal, program)
      DO UPDATE SET
        nilai = excluded.nilai,
        catatan = excluded.catatan,
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(
      id_atlet,
      id_kelas,
      id_jadwal,
      program,
      JSON.stringify(nilai || []), // 🔥 aman
      catatan || null,
    );

    res.json({
      success: true,
      message: "Data berhasil disimpan / diupdate",
    });
  } catch (err) {
    console.error("ERROR DRYLAND:", err.message);

    res.status(500).json({
      error: err.message, // 🔥 tampilkan error asli
    });
  }
});

app.get("/penilaian_dryland", (req, res) => {
  const { id_jadwal, program } = req.query;

  try {
    const rows = db
      .prepare(
        `
      SELECT * FROM penilaian_dryland
      WHERE id_jadwal = ? AND program = ?
    `,
      )
      .all(id_jadwal, program);

    const hasil = rows.map((r) => ({
      ...r,
      nilai: r.nilai ? JSON.parse(r.nilai) : [],
    }));

    res.json(hasil);
  } catch (err) {
    console.error("GET DRYLAND ERROR:", err.message);

    res.status(500).json({
      error: err.message,
    });
  }
});

app.get("/jadwal/:id", (req, res) => {
  const { id } = req.params;

  try {
    const row = db
      .prepare(
        `SELECT j.*, k.nama_kelas
         FROM jadwal j
         JOIN kelas k ON j.id_kelas = k.id_kelas
         WHERE j.id_jadwal = ?`,
      )
      .get(id);

    if (!row) {
      return res.status(404).json({ message: "Data tidak ditemukan" });
    }

    res.json({
      id: row.id_jadwal,
      id_kelas: row.id_kelas,
      title: row.title,
      start: row.start,
      end: row.end,
      lokasi: row.lokasi,
      kategori: row.kategori,
      nama_kelas: row.nama_kelas,
    });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.get("/atlet/kelas/:id_kelas", (req, res) => {
  const { id_kelas } = req.params;

  try {
    const rows = db
      .prepare("SELECT * FROM atlet WHERE id_kelas = ?")
      .all(id_kelas);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/penilaian_teknik", (req, res) => {
  const body = req.body;

  console.log("RECEIVED BODY:", body);

  const {
    id_atlet,
    id_kelas,
    id_jadwal,
    id_pelatih,
    distance,
    stroke_length,
    split_time,
    velocity,
    stroke_count,
    stroke_rate,
    stroke_index,
    rata_rata,
  } = body;

  // VALIDASI WAJIB
  if (!id_atlet || !id_kelas || !id_jadwal || !id_pelatih) {
    return res.status(400).json({
      success: false,
      message: "Data wajib tidak lengkap",
    });
  }

  const sql = `
    INSERT INTO penilaian_teknik (
      id_atlet,
      id_kelas,
      id_jadwal,
      id_pelatih,
      distance,
      stroke_length,
      split_time,
      velocity,
      stroke_count,
      stroke_rate,
      stroke_index,
      rata_rata
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id_atlet, id_jadwal)
    DO UPDATE SET
      id_kelas = excluded.id_kelas,
      id_pelatih = excluded.id_pelatih,
      distance = excluded.distance,
      stroke_length = excluded.stroke_length,
      split_time = excluded.split_time,
      velocity = excluded.velocity,
      stroke_count = excluded.stroke_count,
      stroke_rate = excluded.stroke_rate,
      stroke_index = excluded.stroke_index,
      rata_rata = excluded.rata_rata,
      updated_at = CURRENT_TIMESTAMP
  `;

  const values = [
    id_atlet,
    id_kelas,
    id_jadwal,
    id_pelatih,
    distance || 0,
    stroke_length || 0,
    split_time || 0,
    velocity || 0,
    stroke_count || 0,
    stroke_rate || 0,
    stroke_index || 0,
  ];

  try {
    // 🔍 ambil stroke_index sebelumnya (data terakhir di DB)
    const prev = db
      .prepare(
        `
    SELECT stroke_index
    FROM penilaian_teknik
    WHERE id_atlet = ? AND id_kelas = ?
    ORDER BY id_penilaian_teknik DESC
    LIMIT 1
  `,
      )
      .get(id_atlet, id_kelas);

    // 🔥 hitung rata-rata (persentase perubahan)
    let rataRataHitung = 0;

    if (prev && prev.stroke_index !== 0) {
      rataRataHitung = (stroke_index - prev.stroke_index) / prev.stroke_index;
    }

    // 🧠 override nilai dari frontend
    const values = [
      id_atlet,
      id_kelas,
      id_jadwal,
      id_pelatih,
      distance || 0,
      stroke_length || 0,
      split_time || 0,
      velocity || 0,
      stroke_count || 0,
      stroke_rate || 0,
      stroke_index || 0,
      rataRataHitung, // 🔥 pakai hasil backend
    ];

    const stmt = db.prepare(sql);
    const result = stmt.run(...values);

    return res.json({
      success: true,
      message: "Data berhasil disimpan / diupdate",
      id: result.lastInsertRowid,
    });
  } catch (err) {
    console.error("DB ERROR:", err.message);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

app.get("/penilaian_teknik/:id_atlet/:id_jadwal", (req, res) => {
  const idAtlet = Number(req.params.id_atlet);
  const idJadwal = Number(req.params.id_jadwal);

  try {
    console.log("PARAM:", idAtlet, idJadwal);

    const data = db
      .prepare(
        `
        SELECT * FROM penilaian_teknik
        WHERE id_atlet = ? AND id_jadwal = ?
      `,
      )
      .get(idAtlet, idJadwal);

    console.log("HASIL:", data);

    res.json(data || null);
  } catch (err) {
    console.error("GET TEKNIK ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/absensi", (req, res) => {
  console.log("BODY:", req.body);

  const body = req.body || {};
  const { id_atlet, id_kelas, id_jadwal, tanggal, status } = body;

  if (!id_atlet || !id_kelas || !tanggal || status === undefined) {
    return res.status(400).json({ message: "Data tidak lengkap" });
  }

  const sql = `
    INSERT INTO absensi (id_atlet, id_kelas, id_jadwal, tanggal, status)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id_atlet, tanggal)
    DO UPDATE SET
      status = excluded.status,
      updated_at = CURRENT_TIMESTAMP
  `;

  const params = [
    Number(id_atlet),
    Number(id_kelas),
    id_jadwal ? Number(id_jadwal) : null,
    tanggal,
    Number(status),
  ];

  try {
    const stmt = db.prepare(sql);
    stmt.run(params);

    res.json({
      message: "Absensi berhasil disimpan / diupdate",
    });
  } catch (err) {
    console.error("ERROR ABSENSI FULL:", err);
    res.status(500).json({ message: err.message });
  }
});

app.get("/absensi/:id_atlet", (req, res) => {
  try {
    const { id_atlet } = req.params;

    const sql = `
      SELECT tanggal, status
      FROM absensi
      WHERE id_atlet = ?
    `;

    const rows = db.prepare(sql).all(id_atlet);

    res.json(rows);
  } catch (err) {
    console.error("ERROR ABSENSI:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/raport", (req, res) => {
  const { id_atlet, start_date, end_date } = req.body;

  try {
    // 🔹 DATA ATLET
    const atlet = db
      .prepare(
        `
        SELECT a.*, k.nama_kelas
        FROM atlet a
        LEFT JOIN kelas k ON a.id_kelas = k.id_kelas
        WHERE a.id_atlet = ?
      `,
      )
      .get(id_atlet);

    if (!atlet) {
      return res.status(404).json({ error: "Atlet tidak ditemukan" });
    }

    // 🔹 SWIM
    const swimRaw = db
      .prepare(
        `
    SELECT 
      p.program,
      p.rata_rata,
      j.start,
      p.id_jadwal,
      j.title
    FROM penilaian p
    JOIN jadwal j ON p.id_jadwal = j.id_jadwal
    WHERE p.id_atlet = ?
      AND p.id_kelas = ?
      AND DATE(j.start) BETWEEN ? AND ?
ORDER BY j.start ASC
  `,
      )
      .all(id_atlet, atlet.id_kelas, start_date, end_date);

    // 🔹 NORMALIZE DATA
    const normalized = swimRaw.map((d) => ({
      ...d,
      title_norm: d.title?.toUpperCase().trim(),
      program_norm: d.program?.toUpperCase().trim(),
    }));

    const swim = normalized.map((d) => ({
      program: d.program_norm,
      title: d.title_norm,
      start: d.start,
      rata_rata: d.rata_rata,
      id_jadwal: d.id_jadwal,
    }));

    // 🔹 DRYLAND
    const dryland = db
      .prepare(
        `
    SELECT 
  d.id_atlet,
  d.id_kelas,
  d.id_jadwal,
  d.program,
  d.nilai,
  j.start -- 🔥 ini penting
FROM penilaian_dryland d
JOIN jadwal j ON d.id_jadwal = j.id_jadwal
WHERE d.id_atlet = ?
  AND d.id_kelas = ?
  AND DATE(j.start) BETWEEN ? AND ?
ORDER BY j.start ASC
  `,
      )
      .all(id_atlet, atlet.id_kelas, start_date, end_date);

    // 🔹 DATA KELAS (🔥 INI YANG KURANG)
    const kelas = db
      .prepare(`SELECT * FROM kelas WHERE id_kelas = ?`)
      .get(atlet.id_kelas);

    const teknikRaw = db
      .prepare(
        `
    SELECT
  j.start as tanggal, -- 🔥 ganti ini
  t.distance,
  t.split_time,
  t.stroke_count,
  t.stroke_length,
  t.velocity,
  t.stroke_rate,
  t.stroke_index,
  t.rata_rata
FROM penilaian_teknik t
JOIN jadwal j ON t.id_jadwal = j.id_jadwal
WHERE t.id_atlet = ?
  AND t.id_kelas = ?
  AND DATE(j.start) BETWEEN ? AND ?
ORDER BY j.start ASC
  `,
      )
      .all(id_atlet, atlet.id_kelas, start_date, end_date);

    const teknik = teknikRaw.map((d) => ({
      ...d,
      percentage: ((d.rata_rata ?? 0) * 100).toFixed(2),
    }));

    // 🔹 ABSENSI
    const absensiRaw = db
      .prepare(
        `
    SELECT 
      tanggal,
      status
    FROM absensi
    WHERE id_atlet = ?
      AND id_kelas = ?
      AND DATE(tanggal) BETWEEN ? AND ?
    ORDER BY tanggal ASC
  `,
      )
      .all(id_atlet, atlet.id_kelas, start_date, end_date);

    // mapping biar gampang dipakai di frontend
    const absensi = absensiRaw.map((a) => ({
      tanggal: a.tanggal,
      status: a.status, // 1=Masuk, 2=Tidak, 3=Ijin
    }));

    res.json({
      atlet,
      kelas,
      swim,
      dryland,
      teknik,
      absensi,
      catatan: [],
    });
  } catch (err) {
    console.error("ERROR RAPORT FULL:", err.message);
    console.error(err.stack);
    res.status(500).json({ error: err.message }); // 🔥 tampilkan error asli
  }
});

// ================== STATIC FOTO ==================
app.use("/foto", express.static(path.join(__dirname, "foto")));

// ================== RUN SERVER ==================
app.listen(5000, "localhost", () => {
  console.log("Server SQLite jalan di localhost:5000 🚀");
});
