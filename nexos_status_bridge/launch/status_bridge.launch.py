"""NEXOS robot-side status bridge.

Brings up rosbridge (WebSocket endpoint for the ros_status ground station) plus
the nexos_status_agent (host vitals -> /diagnostics). Install this on every UGV.
"""
import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription
from launch.launch_description_sources import AnyLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def generate_launch_description():
    rosbridge_launch = os.path.join(
        get_package_share_directory('rosbridge_server'),
        'launch', 'rosbridge_websocket_launch.xml',
    )
    port = LaunchConfiguration('port')

    return LaunchDescription([
        DeclareLaunchArgument('port', default_value='9090',
                              description='rosbridge WebSocket port'),
        IncludeLaunchDescription(
            AnyLaunchDescriptionSource(rosbridge_launch),
            launch_arguments={'port': port}.items(),
        ),
        Node(
            package='nexos_status_agent',
            executable='agent',
            name='nexos_status_agent',
            output='screen',
            respawn=True,
        ),
    ])
