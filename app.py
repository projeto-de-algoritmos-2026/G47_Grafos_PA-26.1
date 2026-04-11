import heapq
from collections import deque

import osmnx as ox
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)


center = ox.geocode("Asa Norte, Brasília, Distrito Federal, Brasil")
G = ox.graph_from_point(center, dist=3000, network_type="walk")
print(f"Graph loaded: {len(G.nodes)} nodes, {len(G.edges)} edges")



def dijkstra(graph, source, target):
    dist = {node: float("inf") for node in graph.nodes}
    prev = {node: None for node in graph.nodes}
    visited_count = 0
    dist[source] = 0
    pq = [(0, source)]

    while pq:
        d, u = heapq.heappop(pq)
        if d > dist[u]:
            continue
        visited_count += 1
        if u == target:
            break
        for v, edge_data in graph[u].items():
            weight = edge_data[0].get("length", 1)
            alt = dist[u] + weight
            if alt < dist[v]:
                dist[v] = alt
                prev[v] = u
                heapq.heappush(pq, (alt, v))

    path = []
    node = target
    while node is not None:
        path.append(node)
        node = prev[node]
    path.reverse()

    if not path or path[0] != source:
        return [], float("inf"), visited_count

    return path, dist[target], visited_count


def bfs(graph, source, target):
    visited = set()
    queue = deque([source])
    prev = {node: None for node in graph.nodes}
    visited_count = 0

    visited.add(source)

    while queue:
        u = queue.popleft()
        visited_count += 1

        if u == target:
            break

        "percorre vizinhos"
        for v in graph[u]:
            if v not in visited:
                visited.add(v)
                prev[v] = u
                queue.append(v)

    "reconstrução do caminho"
    path = []
    node = target
    while node is not None:
        path.append(node)
        node = prev[node]
    path.reverse()

    if not path or path[0] != source:
        return [], visited_count

    return path, visited_count
    

def nodes_to_coords(path):
    """Acha a latitude e longitude de cada nó do caminho"""
    coords = []
    for node in path:
        data = G.nodes[node]
        coords.append([data["y"], data["x"]])
    return coords


def parse_latlng(request):
    slat = float(request.args["slat"])
    slng = float(request.args["slng"])
    tlat = float(request.args["tlat"])
    tlng = float(request.args["tlng"])
    return slat, slng, tlat, tlng



@app.route("/shortest-path")
def shortest_path():
    """Calcula o caminho mais curto entre dois pontos usando Dijkstra"""
    slat, slng, tlat, tlng = parse_latlng(request)
    source = ox.distance.nearest_nodes(G, slng, slat)
    target = ox.distance.nearest_nodes(G, tlng, tlat)

    path, distance, visited = dijkstra(G, source, target)

    if not path:
        return jsonify({"error": "No path found"}), 404

    return jsonify({
        "path": nodes_to_coords(path),
        "distance_m": round(distance, 2),
        "nodes_visited": visited,
        "algorithm": "dijkstra",
    })


@app.route("/nodes")
def nodes():
    node_list = [
        {"id": node, "lat": data["y"], "lng": data["x"]}
        for node, data in G.nodes(data=True)
    ]
    return jsonify({"count": len(node_list), "nodes": node_list})


@app.route("/graph-info")
def graph_info():
    return jsonify({
        "node_count": len(G.nodes),
        "edge_count": len(G.edges),
        "place": "Asa Norte, Brasília, Distrito Federal, Brasil",
        "network_type": "walk",
    })


if __name__ == "__main__":
    app.run(debug=True)
