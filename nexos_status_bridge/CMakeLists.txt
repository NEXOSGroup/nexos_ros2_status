cmake_minimum_required(VERSION 3.10)
project(nexos_status_bridge)

find_package(ament_cmake REQUIRED)

install(DIRECTORY launch systemd
  DESTINATION share/${PROJECT_NAME})

ament_package()
