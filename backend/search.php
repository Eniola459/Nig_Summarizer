<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");  
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

$host = "localhost";
$username = "root";
$password = "";
$database = "nigerian_constitution";

$conn = new mysqli($host, $username, $password, $database);
if ($conn->connect_error) {
    die(json_encode(["error" => "Database connection failed: " . $conn->connect_error]));
}

$data = json_decode(file_get_contents("php://input"), true);
$filter = isset($data["filter"]) ? $conn->real_escape_string($data["filter"]) : "";
$subFilter = isset($data["subFilter"]) ? $conn->real_escape_string($data["subFilter"]) : "";
$keyword = isset($data["keyword"]) ? "%" . $conn->real_escape_string($data["keyword"]) . "%" : "%";

// Build SQL Query Based on Filters
$sql = "SELECT * FROM constitution WHERE content LIKE ?"; 
$params = ["s", $keyword];

if (!empty($filter)) {
    switch ($filter) {
        case "chapter":
            $sql = "SELECT * FROM constitution WHERE chapter = ? OR section IN 
                    (SELECT section FROM constitution WHERE chapter = ?)";
            $params = ["ss", $filter, $filter];
            break;

        case "part":
            $sql = "SELECT * FROM constitution WHERE part = ? OR section IN 
                    (SELECT section FROM constitution WHERE part = ?)"; 
            $params = ["ss", $filter, $filter];
            break;

        case "section":
            $sql = "SELECT * FROM constitution WHERE section = ? OR subsection IN 
                    (SELECT subsection FROM constitution WHERE section = ?)"; 
            $params = ["ss", $filter, $filter];
            break;

        case "subsection":
            $sql = "SELECT * FROM constitution WHERE subsection = ? OR paragraph IN 
                    (SELECT paragraph FROM constitution WHERE subsection = ?)";
            $params = ["ss", $filter, $filter];
            break;

        default:
            $sql = "SELECT * FROM constitution WHERE content LIKE ?";
            $params = ["s", $keyword];
            break;
    }

    // Apply subFilter (if selected)
    if (!empty($subFilter)) {
        $sql .= " AND (section = ? OR subsection = ?)";
        array_push($params, $subFilter, $subFilter);
    }
}

// Prepare and Execute Query
$stmt = $conn->prepare($sql);
$stmt->bind_param(...$params);
$stmt->execute();
$result = $stmt->get_result();

$searchResults = [];
while ($row = $result->fetch_assoc()) {
    $searchResults[] = $row;
}

$stmt->close();
$conn->close();
echo json_encode(["results" => $searchResults]);
?>
