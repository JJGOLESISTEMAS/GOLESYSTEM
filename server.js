const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Configuración de la conexión a la base de datos
const connection = mysql.createConnection({
  host: 'golemysql-1ee66611-jjgole-6c8b.g.aivencloud.com',
  port: 18285, // Puerto actualizado
  user: 'avnadmin',
  password: 'AVNS_YDkanKxjLBjMY9dq10O',
  database: 'defaultdb',
  ssl: {
    // Se usa el certificado CA solo si es necesario. Si no se necesita, puedes eliminar esta parte.
    //ca: fs.readFileSync('path/to/ca-certificate.crt')
    rejectUnauthorized: false // No verificar el certificado en esta configuración
  }
});

connection.connect(err => {
  if (err) {
    console.error('Error conectando a la base de datos:', err);
    return;
  }
  console.log('Conectado a la base de datos MySQL');
});

app.use(express.static(path.join(__dirname, 'views')));
app.use('/icons', express.static(path.join(__dirname, 'icons')));


// Rutas de la API
// Endpoint para obtener todos los usuarios con su foto
app.get('/api/PersonalActivo', (req, res) => {
  connection.query('SELECT id, Nombre, Categoria, Departamento, LiderDeArea, NomUsu, contrasena, url_foto FROM PersonalActivo', (err, results) => {
    if (err) {
      console.error('Error en la consulta:', err);
      return res.status(500).json({ error: 'Error en la consulta a la base de datos' });
    }
    res.json(results);
  });
});

// Endpoint para obtener la foto de un usuario específico por nombre
app.get('/api/PersonalActivo/:nombre', (req, res) => {
  const nombre = req.params.nombre;
  
  connection.query('SELECT Nombre, url_foto FROM PersonalActivo WHERE Nombre = ?', [nombre], (err, results) => {
    if (err) {
      console.error('Error en la consulta:', err);
      return res.status(500).json({ error: 'Error en la consulta a la base de datos' });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(results[0]);
  });
});


app.post('/api/login', (req, res) => {
  const { NomUsu, contrasena } = req.body;
  const query = 'SELECT * FROM PersonalActivo WHERE NomUsu = ? AND contrasena = ?';

  connection.query(query, [NomUsu, contrasena], (err, results) => {
    if (err) {
      return res.status(500).send(err);
    }
    if (results.length === 0) {
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }
    // Enviar toda la información del usuario
    res.status(200).json({ message: 'Inicio de sesión exitoso', user: results[0] });
  });
});


app.post('/api/guardarRequisicion', (req, res) => {
  const requisicion = req.body;

  const query = `
    INSERT INTO requisiciones (date, department, customer, contractNumber, requiredBy, requisitionNo, projectLocation, jobOrder, equipmentNo, drawingNo, review, requiredDeliveredDate, notes, reviewedBy, preparedBy, approvedBy, authorizedBy, receivedBy)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const requisicionValues = [
    requisicion.date,
    requisicion.department,
    requisicion.customer,
    requisicion.contractNumber,
    requisicion.requiredBy,
    requisicion.requisitionNo,
    requisicion.projectLocation,
    requisicion.jobOrder,
    requisicion.equipmentNo,
    requisicion.drawingNo,
    requisicion.review,
    requisicion.requiredDeliveredDate,
    requisicion.notes,
    requisicion.reviewedBy,
    requisicion.preparedBy,
    requisicion.approvedBy,
    requisicion.authorizedBy,
    requisicion.receivedBy
  ];

  connection.query(query, requisicionValues, (err, result) => {
    if (err) {
      console.error('Error guardando la requisición:', err);
      res.status(500).json({ error: 'Error guardando la requisición' });
      return;
    }

    const requisicionId = result.insertId;

    const itemsQuery = `
      INSERT INTO requisicion_items (requisicion_id, quantity, unit, description, specification, stock, remarks)
      VALUES ?
    `;

    const itemsValues = requisicion.sections.flatMap(section => section.items.map(item => [
      requisicionId,
      item.quantity || 0, // Asegúrate de que no sea vacío
      item.unit,
      item.description,
      item.specification,
      item.stock,
      item.remarks
    ]));

    connection.query(itemsQuery, [itemsValues], (err, result) => {
      if (err) {
        console.error('Error guardando los ítems de la requisición:', err);
        res.status(500).json({ error: 'Error guardando los ítems de la requisición' });
        return;
      }

      res.status(200).json({ message: 'Requisición guardada exitosamente' });
    });
  });
});

// Endpoint para obtener detalles de una requisición por ID con sus items
app.get('/api/requisiciones/:id', (req, res) => {
  const requisicionId = req.params.id;

  const query = `
    SELECT 
      r.id AS requisicion_id,
      r.date,
      r.department,
      r.customer,
      r.contractNumber,
      r.requiredBy,
      r.requisitionNo,
      r.projectLocation,
      r.jobOrder,
      r.equipmentNo,
      r.drawingNo,
      r.review,
      r.requiredDeliveredDate,
      r.notes,
      r.reviewedBy,
      r.preparedBy,
      r.approvedBy,
      r.authorizedBy,
      r.receivedBy,
      ri.id AS item_id,
      ri.quantity,
      ri.unit,
      ri.description,
      ri.specification,
      ri.stock,
      ri.remarks
    FROM 
      requisiciones r
    INNER JOIN 
      requisicion_items ri ON r.id = ri.requisicion_id
    WHERE 
      r.id = ?
  `;

  connection.query(query, [requisicionId], (err, results) => {
    if (err) {
      console.error('Error obteniendo detalles de la requisición:', err);
      res.status(500).json({ error: 'Error obteniendo detalles de la requisición' });
      return;
    }
    res.json(results);
  });
});

// Endpoint para obtener todas las requisiciones con sus items
app.get('/api/requisiciones', (req, res) => {
  const query = `
    SELECT 
      r.id AS requisicion_id,
      r.*,
      ri.id AS item_id,
      ri.*
    FROM 
      requisiciones r
    INNER JOIN 
      requisicion_items ri ON r.id = ri.requisicion_id
  `;

  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error obteniendo todas las requisiciones:', err);
      res.status(500).json({ error: 'Error obteniendo todas las requisiciones' });
      return;
    }
    res.json(results);
  });
});

// Ruta para insertar un nuevo proveedor y su dirección
app.post('/api/proveedores', (req, res) => {
  const { nombreRazonSocial, nombreComercial, rfc, nombreContacto, correoElectronico, telefono, calleNumero, colonia, localidadMunicipio, codigoPostal, ciudadEstado, pais, banco, numeroCuenta, clabeInterbancaria } = req.body;

  const domicilioQuery = `
    INSERT INTO DomPro (calle_numero, colonia, localidad_municipio, codigo_postal, ciudad_estado, pais)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  connection.query(domicilioQuery, [calleNumero, colonia, localidadMunicipio, codigoPostal, ciudadEstado, pais], (err, result) => {
    if (err) {
      console.error('Error guardando la dirección del proveedor:', err);
      res.status(500).json({ error: 'Error guardando la dirección del proveedor' });
      return;
    }

    const domicilioId = result.insertId;

    const proveedorQuery = `
      INSERT INTO Provvedores (nombre_razon_social_persona_moral, nombre_comercial, rfc, nombre_contacto, correo_electronico, telefono, domicilio_id, banco, numero_cuenta, clabe_interbancaria)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    connection.query(proveedorQuery, [nombreRazonSocial, nombreComercial, rfc, nombreContacto, correoElectronico, telefono, domicilioId, banco, numeroCuenta, clabeInterbancaria], (err, result) => {
      if (err) {
        console.error('Error guardando el proveedor:', err);
        res.status(500).json({ error: 'Error guardando el proveedor' });
        return;
      }

      res.status(200).json({ message: 'Proveedor guardado exitosamente' });
    });
  });
});

// Ruta para obtener todos los proveedores con sus domicilios
app.get('/api/proveedores', (req, res) => {
  const query = `
    SELECT 
      p.id AS proveedor_id,
      p.nombre_razon_social_persona_moral AS nombreRazonSocial,
      p.nombre_comercial AS nombreComercial,
      p.rfc,
      p.nombre_contacto AS nombreContacto,
      p.correo_electronico AS correoElectronico,
      p.telefono,
      p.banco,
      p.numero_cuenta AS numeroCuenta,
      p.clabe_interbancaria AS clabeInterbancaria,
      d.id AS domicilio_id,
      d.calle_numero AS calleNumero,
      d.colonia,
      d.localidad_municipio AS localidadMunicipio,
      d.codigo_postal AS codigoPostal,
      d.ciudad_estado AS ciudadEstado,
      d.pais
    FROM 
      Provvedores p
    INNER JOIN 
      DomPro d ON p.domicilio_id = d.id;
  `;

  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error obteniendo proveedores con domicilios:', err);
      res.status(500).json({ error: 'Error obteniendo proveedores con domicilios' });
      return;
    }
    res.json(results);
  });
});

// Endpoint para agregar un nuevo producto
app.post('/api/products', (req, res) => {
  const { name, categoryId, stock, brand, model, presentationId, photoUrl, codigo } = req.body;

  // Inserta el producto en la base de datos
  const query = `
    INSERT INTO productos (nombre, categoria_id, stock, marca, modelo, presentacion_id, foto_url, codigo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [name, categoryId, stock, brand, model, presentationId, photoUrl, codigo];

  connection.query(query, values, (err, result) => {
    if (err) {
      console.error('Error insertando producto:', err);
      return res.status(500).json({ error: 'Error insertando producto' });
    }
    res.status(200).json({ message: 'Producto agregado exitosamente' });
  });
});


// Endpoint para obtener todos los productos con nombres de categoría y presentación
app.get('/api/products', (req, res) => {
  const query = `
    SELECT 
      p.id AS id,
      p.nombre AS nombre,
      p.stock AS stock,
      p.marca AS marca,
      p.modelo AS modelo,
      p.foto_url AS foto_url,
      p.codigo AS codigo, -- Incluyendo el código del producto
      c.nombre AS categoria,
      pr.nombre AS presentacion
    FROM 
      productos p
    INNER JOIN 
      categorias c ON p.categoria_id = c.id
    INNER JOIN 
      presentaciones pr ON p.presentacion_id = pr.id
  `;

  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error obteniendo productos:', err);
      return res.status(500).json({ error: 'Error obteniendo productos' });
    }
    res.json(results);
  });
});

app.get('/api/categories', (req, res) => {
  connection.query('SELECT * FROM categorias', (err, results) => {
    if (err) {
      console.error('Error obteniendo categorías:', err);
      return res.status(500).json({ error: 'Error obteniendo categorías' });
    }
    res.json(results);
  });
});

app.get('/api/presentations', (req, res) => {
  connection.query('SELECT * FROM presentaciones', (err, results) => {
    if (err) {
      console.error('Error obteniendo presentaciones:', err);
      return res.status(500).json({ error: 'Error obteniendo presentaciones' });
    }
    res.json(results);
  });
});

app.post('/api/guardarorden', (req, res) => {
  const { 
    order_number, 
    requisition_number, 
    area, 
    supplier_id, 
    subtotal, 
    discount, 
    total, 
    currency, 
    tax, 
    items 
  } = req.body;

  // Insertar la orden
  const queryOrder = `
    INSERT INTO ordenes (order_number, requisition_number, area, supplier_id, subtotal, discount, total, currency, tax)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  connection.query(queryOrder, [order_number, requisition_number, area, supplier_id, subtotal, discount, total, currency, tax], (error, results) => {
    if (error) {
      console.error('Error al guardar la orden:', error);
      return res.status(500).send('Error en la base de datos');
    }

    const newOrderId = results.insertId;

    // Preparar los datos para insertar los ítems
    const itemsQuery = `
      INSERT INTO orden_items (order_id, equipment_no, description, unit, quantity, unit_price, importe)
      VALUES ?
    `;

    const itemsValues = items.map(item => [
      newOrderId,
      item.equipmentNo,
      item.description,
      item.unit,
      item.quantity,
      item.unitPrice,
      item.importe
    ]);

    connection.query(itemsQuery, [itemsValues], (error) => {
      if (error) {
        console.error('Error al guardar los ítems de la orden:', error);
        return res.status(500).send('Error en la base de datos');
      }

      res.status(200).json({ message: 'Orden guardada exitosamente', orderId: newOrderId });
    });
  });
});


app.get('/api/ordenes', (req, res) => {
  const query = `
    SELECT 
      o.id AS order_id,
      o.order_number,
      o.requisition_number,
      o.area,
      o.supplier_id,
      o.subtotal,
      o.discount,
      o.total,
      o.currency,
      o.tax,
      o.created_at,
      p.nombre_razon_social_persona_moral AS supplier_name,
      p.nombre_contacto AS supplier_contact_name,  -- Incluye el nombre del contacto
      p.nombre_comercial AS supplier_commercial_name,
      p.rfc AS supplier_rfc,
      oi.id AS item_id,
      oi.equipment_no,
      oi.description,
      oi.unit,
      oi.quantity,
      oi.unit_price,
      oi.importe
    FROM 
      ordenes o
    INNER JOIN 
      Provvedores p ON o.supplier_id = p.id
    LEFT JOIN 
      orden_items oi ON o.id = oi.order_id
    ORDER BY 
      o.id, oi.id;
  `;

  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error obteniendo órdenes:', err);
      res.status(500).json({ error: 'Error obteniendo órdenes' });
      return;
    }

    // Organizar los resultados en una estructura de datos más útil
    const orders = {};
    results.forEach(row => {
      if (!orders[row.order_id]) {
        orders[row.order_id] = {
          order_id: row.order_id,
          order_number: row.order_number,
          requisition_number: row.requisition_number,
          area: row.area,
          supplier_id: row.supplier_id,
          subtotal: row.subtotal,
          discount: row.discount,
          total: row.total,
          currency: row.currency,
          tax: row.tax,
          created_at: row.created_at,
          supplier_name: row.supplier_name,
          supplier_contact_name: row.supplier_contact_name,  // Añadido
          supplier_commercial_name: row.supplier_commercial_name,
          supplier_rfc: row.supplier_rfc,
          items: []
        };
      }

      if (row.item_id) {
        orders[row.order_id].items.push({
          item_id: row.item_id,
          equipment_no: row.equipment_no,
          description: row.description,
          unit: row.unit,
          quantity: row.quantity,
          unit_price: row.unit_price,
          importe: row.importe
        });
      }
    });

    // Convertir el objeto en una lista
    const ordersList = Object.values(orders);

    res.json(ordersList);
  });
});

app.post('/api/guardarEntrada', (req, res) => {
  const {
    fecha,
    factura,
    requisicion,
    orden,
    proveedor,
    almacenistaName,
    notas,
    subtotal,
    iva,
    total,
    items
  } = req.body;

  console.log('Datos recibidos en el servidor:', req.body); // Verifica aquí

  connection.beginTransaction(err => {
    if (err) {
      console.error('Error al iniciar la transacción:', err);
      return res.status(500).json({ error: 'Error al iniciar la transacción' });
    }

    const entradaQuery = `
      INSERT INTO entradasalmacen (fecha, factura, requisicion, orden, proveedor, almacenista_name, notas, subtotal, iva, total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const entradaValues = [fecha, factura, requisicion, orden, proveedor, almacenistaName, notas, subtotal, iva, total];

    connection.query(entradaQuery, entradaValues, (err, result) => {
      if (err) {
        return connection.rollback(() => {
          console.error('Error guardando la entrada de almacén:', err);
          res.status(500).json({ error: 'Error guardando la entrada de almacén' });
        });
      }

      const entradaId = result.insertId;

      const itemsQuery = `
        INSERT INTO entradaitems (entrada_id, equipo_no, descripcion, cantidad, unidad, precio_unitario, importe)
        VALUES ?
      `;

      const itemsValues = items.map(item => [
        entradaId,
        item.equipment_no, // Asegúrate de que estos nombres coincidan
        item.description,
        item.quantity,
        item.unit,
        item.unit_price,
        item.importe
      ]);

      connection.query(itemsQuery, [itemsValues], (err) => {
        if (err) {
          return connection.rollback(() => {
            console.error('Error guardando los ítems de la entrada de almacén:', err);
            res.status(500).json({ error: 'Error guardando los ítems de la entrada de almacén' });
          });
        }

        connection.commit(err => {
          if (err) {
            return connection.rollback(() => {
              console.error('Error al confirmar la transacción:', err);
              res.status(500).json({ error: 'Error al confirmar la transacción' });
            });
          }

          res.status(200).json({ message: 'Entrada de almacén guardada exitosamente' });
        });
      });
    });
  });
});

app.post('/api/updateStock', (req, res) => {
  const { updates } = req.body;

  // Suponiendo que `updates` es un array de objetos con `codigo` y `newStock`
  const query = `
    UPDATE productos
    SET stock = ?
    WHERE codigo = ?
  `;

  const updatesPromises = updates.map(update => {
    return new Promise((resolve, reject) => {
      connection.query(query, [update.newStock, update.codigo], (err, results) => {
        if (err) {
          return reject(err);
        }
        resolve(results);
      });
    });
  });

  Promise.all(updatesPromises)
    .then(() => res.json({ success: true }))
    .catch(err => {
      console.error('Error actualizando stock:', err);
      res.status(500).json({ error: 'Error actualizando stock' });
    });
});


app.get('/api/db-schema', (req, res) => {
  const queryTables = `
    SELECT TABLE_NAME 
    FROM information_schema.tables 
    WHERE table_schema = 'defaultdb';
  `;

  connection.query(queryTables, (err, tables) => {
    if (err) {
      console.error('Error obteniendo tablas:', err);
      return res.status(500).json({ error: 'Error obteniendo tablas' });
    }

    const promises = tables.map(table => {
      const queryColumns = `
        SELECT COLUMN_NAME, COLUMN_KEY, DATA_TYPE 
        FROM information_schema.columns 
        WHERE table_name = ? AND table_schema = 'defaultdb';
      `;

      return new Promise((resolve, reject) => {
        connection.query(queryColumns, [table.TABLE_NAME], (err, columns) => {
          if (err) {
            return reject(err);
          }
          resolve({ table: table.TABLE_NAME, columns });
        });
      });
    });

    Promise.all(promises)
      .then(results => res.json(results))
      .catch(err => {
        console.error('Error obteniendo columnas:', err);
        res.status(500).json({ error: 'Error obteniendo columnas' });
      });
  });
});
 
const PORT = 18285; // Puerto actualizado
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
