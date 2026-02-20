CREATE DATABASE ProductScannerDB;
GO

USE ProductScannerDB;
GO

CREATE TABLE Usuario (
    UserId INT IDENTITY(1,1) PRIMARY KEY,
    Nombre NVARCHAR(100) NOT NULL,
    Email NVARCHAR(150) NOT NULL UNIQUE,
    FechaRegistro DATETIME2 NOT NULL DEFAULT GETDATE(),
    NivelConfianza INT NOT NULL DEFAULT 0,
    Activo BIT NOT NULL DEFAULT 1
);

CREATE TABLE Producto (
    ProductoId INT IDENTITY(1,1) PRIMARY KEY,
    CodigoBarra NVARCHAR(50) NOT NULL,
    NombreProducto NVARCHAR(150) NOT NULL,
    Marca NVARCHAR(100),
    Categoria NVARCHAR(100),
    Imagen VARBINARY(MAX),
    Activo BIT NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IX_Producto_CodigoBarra
ON Producto (CodigoBarra);

CREATE TABLE Supermercado (
    SupermercadoId INT IDENTITY(1,1) PRIMARY KEY,
    Nombre NVARCHAR(100) NOT NULL,
    Logo VARBINARY(MAX),
    Pais NVARCHAR(50),
    Activo BIT NOT NULL DEFAULT 1
);

CREATE TABLE Sucursal (
    SucursalId INT IDENTITY(1,1) PRIMARY KEY,
    SupermercadoId INT NOT NULL,
    NombreSucursal NVARCHAR(150) NOT NULL,
    Direccion NVARCHAR(200),
    Comuna NVARCHAR(100),
    Region NVARCHAR(100),
    Latitud DECIMAL(9,6),
    Longitud DECIMAL(9,6),
    Activo BIT NOT NULL DEFAULT 1,

    CONSTRAINT FK_Sucursal_Supermercado
        FOREIGN KEY (SupermercadoId)
        REFERENCES Supermercado(SupermercadoId)
);

CREATE TABLE RegistroPrecio (
    RegistroPrecioId INT IDENTITY(1,1) PRIMARY KEY,
    ProductoId INT NOT NULL,
    SucursalId INT NOT NULL,
    Precio DECIMAL(10,2) NOT NULL,
    FechaRegistro DATETIME2 NOT NULL DEFAULT GETDATE(),
    UserId INT NOT NULL,
    Fuente NVARCHAR(50) NOT NULL,
    EsValido BIT NOT NULL DEFAULT 1,

    CONSTRAINT FK_RegistroPrecio_Producto
        FOREIGN KEY (ProductoId)
        REFERENCES Producto(ProductoId),

    CONSTRAINT FK_RegistroPrecio_Sucursal
        FOREIGN KEY (SucursalId)
        REFERENCES Sucursal(SucursalId),

    CONSTRAINT FK_RegistroPrecio_Usuario
        FOREIGN KEY (UserId)
        REFERENCES Usuario(UserId)
);

CREATE INDEX IX_RegistroPrecio_Producto_Fecha
ON RegistroPrecio (ProductoId, FechaRegistro DESC);

CREATE INDEX IX_RegistroPrecio_Sucursal
ON RegistroPrecio (SucursalId);

CREATE TABLE CompraUsuario (
    CompraId INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NOT NULL,
    FechaCompra DATETIME2 NOT NULL DEFAULT GETDATE(),
    TotalCompra DECIMAL(10,2) NOT NULL,
    SucursalId INT NOT NULL,

    CONSTRAINT FK_CompraUsuario_Usuario
        FOREIGN KEY (UserId)
        REFERENCES Usuario(UserId),

    CONSTRAINT FK_CompraUsuario_Sucursal
        FOREIGN KEY (SucursalId)
        REFERENCES Sucursal(SucursalId)
);

CREATE TABLE DetalleCompra (
    DetalleCompraId INT IDENTITY(1,1) PRIMARY KEY,
    CompraId INT NOT NULL,
    ProductoId INT NOT NULL,
    PrecioUnitario DECIMAL(10,2) NOT NULL,
    Cantidad INT NOT NULL,
    Subtotal DECIMAL(10,2) NOT NULL,

    CONSTRAINT FK_DetalleCompra_Compra
        FOREIGN KEY (CompraId)
        REFERENCES CompraUsuario(CompraId),

    CONSTRAINT FK_DetalleCompra_Producto
        FOREIGN KEY (ProductoId)
        REFERENCES Producto(ProductoId)
);