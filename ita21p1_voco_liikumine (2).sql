-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Apr 05, 2024 at 11:49 AM
-- Server version: 10.3.39-MariaDB
-- PHP Version: 8.1.27

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `ita21p1_voco_liikumine`
--

-- --------------------------------------------------------

--
-- Table structure for table `artiklid`
--

CREATE TABLE `artiklid` (
  `artikli_id` int(11) NOT NULL,
  `kasutaja_id` int(11) NOT NULL,
  `artikli_pealkiri` tinytext NOT NULL,
  `artikli_sisu` longtext NOT NULL,
  `postitamise_kuupäev` datetime NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE=utf8_estonian_ci;

-- --------------------------------------------------------

--
-- Table structure for table `broneerimine`
--

CREATE TABLE `broneerimine` (
  `broneeringu_id` int(11) NOT NULL,
  `kasutaja_id` int(11) NOT NULL,
  `koht` varchar(100) NOT NULL,
  `algusaeg` datetime NOT NULL,
  `lõppaeg` datetime NOT NULL,
  `lisamise_kuupäev` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `esiletõstetud_galerii`
--

CREATE TABLE `esiletõstetud_galerii` (
  `esiletõstetud_media_id` int(11) NOT NULL,
  `media_id` int(11) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE=utf8_estonian_ci;

-- --------------------------------------------------------

--
-- Table structure for table `foorum`
--

CREATE TABLE `foorum` (
  `postituse_id` int(11) NOT NULL,
  `kasutaja_id` int(11) NOT NULL,
  `postituse_pealkiri` tinytext NOT NULL,
  `foorumi_sisu` longtext NOT NULL,
  `postitamise_kuupäev` date NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE=utf8_estonian_ci;

-- --------------------------------------------------------

--
-- Table structure for table `foorumi_kommentaariumid`
--

CREATE TABLE `foorumi_kommentaariumid` (
  `kommentaari_id` int(11) NOT NULL,
  `postituse_id` int(11) NOT NULL,
  `kasutaja_id` int(11) NOT NULL,
  `kommentaari_sisu` longtext NOT NULL,
  `kommentaari_lisamise_kuupäev` datetime NOT NULL,
  `esiletõstetud` tinyint(1) DEFAULT 0
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE=utf8_estonian_ci;

-- --------------------------------------------------------

--
-- Table structure for table `galerii`
--

CREATE TABLE `galerii` (
  `media_id` int(11) NOT NULL,
  `kasutaja_id` int(11) NOT NULL,
  `media` blob NOT NULL,
  `lisamise_kuupäev` datetime NOT NULL,
  `media_nimi` varchar(100) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE=utf8_estonian_ci;

-- --------------------------------------------------------

--
-- Table structure for table `kasutajad`
--

CREATE TABLE `kasutajad` (
  `kasutaja_id` int(11) NOT NULL,
  `rolli_id` int(11) NOT NULL DEFAULT 1,
  `kasutajanimi` varchar(18) NOT NULL,
  `parool` text NOT NULL,
  `telefon` varchar(20) DEFAULT NULL,
  `email` varchar(50) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE=utf8_estonian_ci;

-- --------------------------------------------------------

--
-- Table structure for table `rollid`
--

CREATE TABLE `rollid` (
  `rolli_id` int(11) NOT NULL,
  `rolli_nimetus` varchar(7) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE=utf8_estonian_ci;

--
-- Dumping data for table `rollid`
--

INSERT INTO `rollid` (`rolli_id`, `rolli_nimetus`) VALUES
(1, 'õpilane'),
(2, 'õpetaja'),
(3, 'admin');

-- --------------------------------------------------------

--
-- Table structure for table `trennid`
--

CREATE TABLE `trennid` (
  `trenni_id` int(11) NOT NULL,
  `kasutaja_id` int(11) NOT NULL,
  `trenni_nimi` text NOT NULL,
  `trenni_selgitus` text NOT NULL,
  `trenni_lisamise_kuupäev` datetime NOT NULL,
  `asukoht` enum('Põllu','Kopli') NOT NULL,
  `trenni_klass` varchar(50) NOT NULL,
  `trenni_toimumise_päev` varchar(200) NOT NULL,
  `trenni_toimumise_algusaeg` time NOT NULL,
  `trenni_toimumise_lõppaeg` time NOT NULL,
  `trenni_värv` varchar(9) NOT NULL DEFAULT '#2980b9'
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE=utf8_estonian_ci;

-- --------------------------------------------------------

--
-- Table structure for table `trennis_käijad`
--

CREATE TABLE `trennis_käijad` (
  `kasutaja_id` int(11) NOT NULL,
  `trenni_id` int(11) NOT NULL,
  `sugu` enum('naine','mees') NOT NULL,
  `nimi` varchar(50) NOT NULL,
  `õppegrupp` varchar(10) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE=utf8_estonian_ci;

-- --------------------------------------------------------

--
-- Table structure for table `trennis_osalejad`
--

CREATE TABLE `trennis_osalejad` (
  `trenni_id` int(11) NOT NULL,
  `kasutaja_id` int(11) NOT NULL,
  `kuupäev` datetime NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `trenni_staatus`
--

CREATE TABLE `trenni_staatus` (
  `staatuse_id` int(11) NOT NULL,
  `trenni_id` int(11) NOT NULL,
  `tühistatud` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE=utf8_estonian_ci;

-- --------------------------------------------------------

--
-- Table structure for table `uudised`
--

CREATE TABLE `uudised` (
  `uudise_id` int(11) NOT NULL,
  `kasutaja_id` int(11) NOT NULL,
  `uudise_pealkiri` tinytext NOT NULL,
  `uudise_sisu` longtext NOT NULL,
  `postitamise_kuupäev` datetime NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE=utf8_estonian_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `artiklid`
--
ALTER TABLE `artiklid`
  ADD PRIMARY KEY (`artikli_id`),
  ADD KEY `kasutaja_id` (`kasutaja_id`);

--
-- Indexes for table `broneerimine`
--
ALTER TABLE `broneerimine`
  ADD PRIMARY KEY (`broneeringu_id`);

--
-- Indexes for table `esiletõstetud_galerii`
--
ALTER TABLE `esiletõstetud_galerii`
  ADD PRIMARY KEY (`esiletõstetud_media_id`),
  ADD KEY `esiletõstetud_media_id` (`media_id`);

--
-- Indexes for table `foorum`
--
ALTER TABLE `foorum`
  ADD PRIMARY KEY (`postituse_id`),
  ADD KEY `kasutaja_id` (`kasutaja_id`);

--
-- Indexes for table `foorumi_kommentaariumid`
--
ALTER TABLE `foorumi_kommentaariumid`
  ADD PRIMARY KEY (`kommentaari_id`),
  ADD KEY `postituse_id` (`postituse_id`),
  ADD KEY `kasutaja_id` (`kasutaja_id`);

--
-- Indexes for table `galerii`
--
ALTER TABLE `galerii`
  ADD PRIMARY KEY (`media_id`),
  ADD KEY `kasutaja_id` (`kasutaja_id`);

--
-- Indexes for table `kasutajad`
--
ALTER TABLE `kasutajad`
  ADD PRIMARY KEY (`kasutaja_id`),
  ADD KEY `rolli_id` (`rolli_id`);

--
-- Indexes for table `rollid`
--
ALTER TABLE `rollid`
  ADD PRIMARY KEY (`rolli_id`);

--
-- Indexes for table `trennid`
--
ALTER TABLE `trennid`
  ADD PRIMARY KEY (`trenni_id`),
  ADD KEY `kasutaja_id` (`kasutaja_id`);

--
-- Indexes for table `trennis_käijad`
--
ALTER TABLE `trennis_käijad`
  ADD PRIMARY KEY (`kasutaja_id`,`trenni_id`),
  ADD KEY `trenni_id` (`trenni_id`);

--
-- Indexes for table `trenni_staatus`
--
ALTER TABLE `trenni_staatus`
  ADD PRIMARY KEY (`staatuse_id`),
  ADD KEY `trenni_aja_id` (`trenni_id`),
  ADD KEY `trenni_aja_id_2` (`trenni_id`),
  ADD KEY `trenni_id` (`trenni_id`);

--
-- Indexes for table `uudised`
--
ALTER TABLE `uudised`
  ADD PRIMARY KEY (`uudise_id`),
  ADD KEY `kasutaja_id` (`kasutaja_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `artiklid`
--
ALTER TABLE `artiklid`
  MODIFY `artikli_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `broneerimine`
--
ALTER TABLE `broneerimine`
  MODIFY `broneeringu_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `esiletõstetud_galerii`
--
ALTER TABLE `esiletõstetud_galerii`
  MODIFY `esiletõstetud_media_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `foorum`
--
ALTER TABLE `foorum`
  MODIFY `postituse_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `foorumi_kommentaariumid`
--
ALTER TABLE `foorumi_kommentaariumid`
  MODIFY `kommentaari_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `galerii`
--
ALTER TABLE `galerii`
  MODIFY `media_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `kasutajad`
--
ALTER TABLE `kasutajad`
  MODIFY `kasutaja_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `trennid`
--
ALTER TABLE `trennid`
  MODIFY `trenni_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `trenni_staatus`
--
ALTER TABLE `trenni_staatus`
  MODIFY `staatuse_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `uudised`
--
ALTER TABLE `uudised`
  MODIFY `uudise_id` int(11) NOT NULL AUTO_INCREMENT;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
